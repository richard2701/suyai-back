<#
.SYNOPSIS
  Worktree-based hotfix flow for the Suyai backend (Strapi 5).

.DESCRIPTION
  Spins up an isolated git worktree off origin/main so you can fix something
  urgent WITHOUT touching your current working tree or stopping your main
  `npm run develop` server.

  Handles the project-specific gotchas:
    - .env is gitignored        -> copied into the worktree
    - PORT=1337 would clash      -> overridden (default 1338) so both run at once
    - node_modules is gitignored -> junction-linked from main repo (instant),
                                     or full install with -Install
    - DB is shared local postgres (suyai_bd) -> worktree hits the SAME db.
      Fine for a hotfix (real data). Avoid schema/content-type changes in a
      hotfix worktree, since two Strapi instances would fight over migrations.

.EXAMPLE
  ./scripts/hotfix.ps1 new email-typo
  # creates ../back-hotfix-email-typo on branch hotfix/email-typo, port 1338

.EXAMPLE
  ./scripts/hotfix.ps1 new email-typo -Port 1339 -Install
  # custom port + clean npm install instead of junction

.EXAMPLE
  ./scripts/hotfix.ps1 done email-typo
  # removes the worktree (branch is kept for the PR)
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)]
  [ValidateSet('new', 'done', 'list')]
  [string]$Command,

  [Parameter(Position = 1)]
  [string]$Name,

  [int]$Port = 1338,

  [switch]$Install,

  [string]$Base = 'origin/main'
)

$ErrorActionPreference = 'Stop'

# Repo root = parent of this scripts/ folder
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ProjectName = Split-Path -Leaf $RepoRoot          # "back"
$ParentDir = Split-Path -Parent $RepoRoot

function Get-WorktreePath([string]$n) {
  Join-Path $ParentDir "$ProjectName-hotfix-$n"
}

# git is a native exe: $ErrorActionPreference='Stop' does NOT trap its failures,
# so check $LASTEXITCODE explicitly after each call.
function Invoke-Git {
  git -C $RepoRoot @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

switch ($Command) {

  'list' {
    Invoke-Git worktree list
    break
  }

  'new' {
    if (-not $Name) { throw "Usage: hotfix.ps1 new <name>" }

    $branch = "hotfix/$Name"
    $wt = Get-WorktreePath $Name

    if (Test-Path $wt) { throw "Worktree path already exists: $wt" }

    Write-Host "==> Fetching origin..." -ForegroundColor Cyan
    Invoke-Git fetch origin --quiet

    Write-Host "==> Creating worktree $wt on $branch (from $Base)" -ForegroundColor Cyan
    Invoke-Git worktree add -b $branch $wt $Base

    # .env (gitignored) -> copy + override PORT for side-by-side running
    $srcEnv = Join-Path $RepoRoot '.env'
    $dstEnv = Join-Path $wt '.env'
    if (Test-Path $srcEnv) {
      Write-Host "==> Copying .env and setting PORT=$Port" -ForegroundColor Cyan
      $envLines = Get-Content $srcEnv
      if ($envLines -match '^\s*PORT=') {
        $envLines = $envLines -replace '^\s*PORT=.*', "PORT=$Port"
      } else {
        $envLines += "PORT=$Port"
      }
      # WriteAllLines with a no-BOM encoding: Set-Content -Encoding UTF8 emits a
      # BOM under Windows PowerShell 5.1, which can corrupt the first .env key.
      [System.IO.File]::WriteAllLines($dstEnv, $envLines, (New-Object System.Text.UTF8Encoding $false))
    } else {
      Write-Warning ".env not found in main repo — worktree has no env file."
    }

    # node_modules (gitignored, heavy)
    $srcNm = Join-Path $RepoRoot 'node_modules'
    $dstNm = Join-Path $wt 'node_modules'
    if ($Install) {
      Write-Host "==> Installing dependencies (npm install)..." -ForegroundColor Cyan
      Push-Location $wt
      try { npm install } finally { Pop-Location }
    }
    elseif (Test-Path $srcNm) {
      Write-Host "==> Junction-linking node_modules from main repo (instant)" -ForegroundColor Cyan
      New-Item -ItemType Junction -Path $dstNm -Target $srcNm | Out-Null
    }
    else {
      Write-Warning "No node_modules in main repo. Run with -Install or 'npm install' in the worktree."
    }

    Write-Host ""
    Write-Host "Ready." -ForegroundColor Green
    Write-Host "  cd `"$wt`""
    Write-Host "  npm run develop      # serves on http://localhost:$Port/admin"
    Write-Host ""
    Write-Host "When done:  ./scripts/hotfix.ps1 done $Name" -ForegroundColor DarkGray
    break
  }

  'done' {
    if (-not $Name) { throw "Usage: hotfix.ps1 done <name>" }
    $wt = Get-WorktreePath $Name

    # Remove the junction first so worktree removal never follows it into the
    # real node_modules.
    $nm = Join-Path $wt 'node_modules'
    if (Test-Path $nm) {
      $item = Get-Item $nm -Force
      if ($item.LinkType -eq 'Junction') {
        Write-Host "==> Removing node_modules junction" -ForegroundColor Cyan
        cmd /c rmdir "$nm" | Out-Null
      }
    }

    Write-Host "==> Removing worktree $wt (branch hotfix/$Name kept)" -ForegroundColor Cyan
    Invoke-Git worktree remove $wt --force
    Invoke-Git worktree prune

    Write-Host "Done. Branch hotfix/$Name still exists for its PR." -ForegroundColor Green
    break
  }
}
