<#
.SYNOPSIS
  Copies the production Postgres database into the local development database.

.DESCRIPTION
  1. Dumps production (read-only) with pg_dump, skipping the DATA of the form tables
     (customer personal data) unless -IncludeForms is passed.
  2. Backs up the current local database.
  3. Drops and recreates the local database, then restores the dump.

  Production connection string comes from .env.prod-db (gitignored):
    PROD_DATABASE_URL=postgresql://user:pass@host/dbname
  Local connection comes from .env (DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD).

.PARAMETER IncludeForms  Keep the rows of form_contacts / form_reservation_* tables.
.PARAMETER Force         Skip the confirmation prompt.
.PARAMETER DryRun        Print the plan and run only the read-only checks.
#>
[CmdletBinding()]
param(
  [switch]$IncludeForms,
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path $root '.tmp'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$formTables = @('form_contacts', 'form_reservation_tours', 'form_reservation_transfers')

function Read-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { throw "Missing $path" }
  $map = @{}
  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $map[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
  }
  return $map
}

function Find-PgTool([string]$name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $hit = Get-ChildItem 'C:\Program Files\PostgreSQL', 'D:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "bin\$name.exe" } |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $hit) { throw "$name not found. Install the PostgreSQL client tools or add them to PATH." }
  return $hit
}

$pgDump = Find-PgTool 'pg_dump'
$pgRestore = Find-PgTool 'pg_restore'
$psql = Find-PgTool 'psql'

$prodEnv = Read-EnvFile (Join-Path $root '.env.prod-db')
$prodUrl = $prodEnv['PROD_DATABASE_URL']
if (-not $prodUrl) { throw 'PROD_DATABASE_URL is empty in .env.prod-db' }

$localEnv = Read-EnvFile (Join-Path $root '.env')
$dbHost = if ($localEnv['DATABASE_HOST']) { $localEnv['DATABASE_HOST'] } else { 'localhost' }
$dbPort = if ($localEnv['DATABASE_PORT']) { $localEnv['DATABASE_PORT'] } else { '5432' }
$dbName = if ($localEnv['DATABASE_NAME']) { $localEnv['DATABASE_NAME'] } else { 'suyai_bd' }
$dbUser = if ($localEnv['DATABASE_USERNAME']) { $localEnv['DATABASE_USERNAME'] } else { 'postgres' }
$dbPass = $localEnv['DATABASE_PASSWORD']

# Hard stop: never restore into anything that is not this machine.
if ($dbHost -notin @('localhost', '127.0.0.1', '::1')) {
  throw "Refusing to run: local target host is '$dbHost', expected localhost."
}
if ($prodUrl -match "@(localhost|127\.0\.0\.1)[:/]") {
  throw 'PROD_DATABASE_URL points to localhost. It must be the production database.'
}

# Version check (client must be >= server major version).
$serverNum = [int](& $psql $prodUrl -At -c 'SHOW server_version_num' 2>&1)
$serverMajor = [math]::Floor($serverNum / 10000)
$clientMajor = [int](([regex]::Match((& $pgDump --version), '(\d+)(\.\d+)?\s*$')).Groups[1].Value)
Write-Host "Production Postgres: $serverMajor | pg_dump client: $clientMajor"
if ($clientMajor -lt $serverMajor) {
  throw "pg_dump $clientMajor cannot dump a Postgres $serverMajor server. Install the $serverMajor client tools."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dumpFile = Join-Path $tmp "prod-$stamp.dump"
$backupFile = Join-Path $tmp "local-backup-$stamp.dump"

$dumpArgs = @('--format=custom', '--no-owner', '--no-acl', '--file', $dumpFile)
if (-not $IncludeForms) {
  foreach ($t in $formTables) { $dumpArgs += "--exclude-table-data=public.$t" }
}

Write-Host ''
Write-Host 'Plan:'
Write-Host "  dump   : production -> $dumpFile (form data: $(if ($IncludeForms) { 'INCLUDED' } else { 'excluded' }))"
Write-Host "  backup : ${dbName}@${dbHost} -> $backupFile"
Write-Host "  restore: DROP + CREATE $dbName on ${dbHost}:$dbPort, then load the dump"

if ($DryRun) { Write-Host "`nDry run: nothing changed."; return }

if (-not $Force) {
  $answer = Read-Host "`nThis REPLACES local database '$dbName'. Type the database name to continue"
  if ($answer -ne $dbName) { Write-Host 'Aborted.'; return }
}

Write-Host "`n[1/4] Dumping production (read-only)..."
& $pgDump @dumpArgs $prodUrl
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }

$env:PGPASSWORD = $dbPass
try {
  $conn = @('-h', $dbHost, '-p', $dbPort, '-U', $dbUser)

  Write-Host '[2/4] Backing up local database...'
  $exists = & $psql @conn -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
  if ($exists -eq '1') {
    & $pgDump @conn --format=custom --file $backupFile $dbName
    if ($LASTEXITCODE -ne 0) { throw 'local backup failed, nothing was dropped' }
  }

  Write-Host '[3/4] Recreating local database...'
  & $psql @conn -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid <> pg_backend_pid()" | Out-Null
  & $psql @conn -d postgres -c "DROP DATABASE IF EXISTS `"$dbName`""
  if ($LASTEXITCODE -ne 0) { throw 'DROP DATABASE failed (is yarn develop still running?)' }
  & $psql @conn -d postgres -c "CREATE DATABASE `"$dbName`""
  if ($LASTEXITCODE -ne 0) { throw 'CREATE DATABASE failed' }

  Write-Host '[4/4] Restoring dump...'
  & $pgRestore @conn --no-owner --no-acl -d $dbName $dumpFile
  if ($LASTEXITCODE -ne 0) { Write-Warning 'pg_restore reported warnings; review the output above.' }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "`nDone. Start the CMS with: yarn develop"
Write-Host "Backup of your previous local DB: $backupFile"
