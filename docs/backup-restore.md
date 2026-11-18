# Database backup and restore runbook (issues #100, #76)

Production database: Render Postgres `suyai-bd` (plan `basic-256mb`, Postgres 16, region
oregon, 1 GB disk). The app connects through `DATABASE_URL`.

> **PII warning.** A full dump contains visitor names, emails, phones and messages (form
> tables). Never commit a dump, never attach it to an issue/PR/chat, never upload it to a shared
> drive without encryption. Keep dumps outside the repo (`D:\Projects\suyai\backups\` locally),
> and delete local copies you no longer need.

## 1. What Render gives us

From https://render.com/docs/postgresql-backups (checked 2026-11-18):

| Mechanism | Retention | Notes |
|-----------|-----------|-------|
| Point-in-time recovery (PITR) | 3 days on a Hobby workspace, 7 days on Pro | Restore creates a **new** database instance; the original is untouched. Point services to it after validating. |
| Logical backups (dashboard export) | 7 days after creation, any plan | Downloadable `pg_dump` file. |

Both live **inside Render**. If the Render account is lost, deleted or locked, so are they.
That is why we also keep an off-Render copy (section 2).

## 2. Backup policy (proposal, owner to confirm)

- **Weekly** logical dump of production to a location outside Render (owner's encrypted
  cloud drive, or a private bucket). Keep the last **8** weekly dumps (about 2 months).
- **Before any risky change** (first live run of the form retention purge #73, disabling
  `draftAndPublish` #76, a Strapi major upgrade, a destructive migration): take a fresh dump and
  note its file name in the PR/issue.
- Retention interaction: once deletion is enabled (#73), purged submissions still live in these
  backups until the backups age out. With 8 weekly dumps, deleted data is fully gone about 2
  months after deletion. State this in the privacy policy (see villa-tour#129).

## 3. Taking a dump (read-only on production)

Tooling: PostgreSQL client tools **>= the server major version** (server is 16; client 17 works).
On this machine: `D:\Program Files\PostgreSQL\17\bin`.

Option A, script (also refreshes the local dev DB):

```powershell
cd D:\Projects\suyai\suyai-back
# .env.prod-db (gitignored) must hold PROD_DATABASE_URL=<Render EXTERNAL connection string>
# and your IP must be allowed in Render > suyai-bd > Access Control.
.\scripts\db-pull-prod.ps1 -DryRun          # read-only checks and plan
.\scripts\db-pull-prod.ps1 -IncludeForms     # full backup incl. form data (PII)
```

Without `-IncludeForms` the script skips the **data** of the form tables, so that dump is NOT a
complete backup. For a backup you must pass `-IncludeForms`.

Option B, plain `pg_dump` (backup only, touches nothing locally):

```powershell
$env:Path = "D:\Program Files\PostgreSQL\17\bin;$env:Path"
pg_dump --format=custom --no-owner --no-acl --file D:\Projects\suyai\backups\prod-YYYY-MM-DD.dump "<PROD_DATABASE_URL>"
pg_restore -l D:\Projects\suyai\backups\prod-YYYY-MM-DD.dump | Select-String "TABLE DATA public form_"   # must list the 3 form tables
```

Option C: Render dashboard > suyai-bd > Recovery > Export (kept 7 days, then download it).

## 4. Restore drill into a throwaway local database

Never restore into production. Never point `DATABASE_URL` at production from a laptop. Use a
**new** local database name so the normal dev DB (`suyai_bd`) stays untouched.

```bash
# Git Bash; PowerShell equivalents work the same way.
export PATH="/d/Program Files/PostgreSQL/17/bin:$PATH"
export PGPASSWORD=<local postgres password>
DB=suyai_drill_$(date +%Y%m%d)
psql -h 127.0.0.1 -U postgres -d postgres -c "CREATE DATABASE $DB"
time pg_restore -h 127.0.0.1 -U postgres --no-owner --no-acl -d $DB /d/Projects/suyai/backups/prod-YYYY-MM-DD.dump
```

Verify the restore (counts only, no PII on screen):

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'articles', count(*) FROM articles UNION ALL
SELECT 'files', count(*) FROM files UNION ALL
SELECT 'admin_users', count(*) FROM admin_users UNION ALL
SELECT 'form_contacts', count(*) FROM form_contacts UNION ALL
SELECT 'form_reservation_tours', count(*) FROM form_reservation_tours UNION ALL
SELECT 'form_reservation_transfers', count(*) FROM form_reservation_transfers;
```

Boot Strapi against it (from a checkout of the **same commit production runs**, i.e. `main`):

```powershell
$env:DATABASE_NAME = 'suyai_drill_YYYYMMDD'   # .env must NOT define DATABASE_URL
$env:RESEND_API_KEY = 're_dummy'                # no real mail from a drill
yarn develop
```

Open `/admin`, log in, spot-check a tour, an article and a form submission. Then drop the
scratch DB: `psql -h 127.0.0.1 -U postgres -d postgres -c "DROP DATABASE suyai_drill_YYYYMMDD"`.

**Gotcha: boot the same code as production.** Strapi syncs the schema on boot. Booting a newer
branch drops tables of content types that branch removed. In the 2026-11-18 drill, booting
`develop` dropped `tour_details` (tour-detail was removed in #134; the table was empty in prod).
That is harmless on a scratch DB, but it means a restore check must use `main`, and it is a
preview of what the next `develop -> main` release does to production.

## 5. Restoring production for real (incident)

1. Prefer **PITR** (Render dashboard > suyai-bd > Recovery): pick a time before the incident.
   Render creates a new instance. Validate it with the queries in section 4.
2. Point the `suyai-app` service `DATABASE_URL` to the new instance (Render env), redeploy, and
   check `/_health`, the home page and one form submission.
3. If PITR is out of window, create a new Render Postgres (same major version, 16) and
   `pg_restore --no-owner --no-acl -d "<NEW_DATABASE_URL>" <dump>`, then step 2.
4. Keep the old instance until the new one is confirmed, then delete it manually.

## 6. Drill log

| Date | Dump | Who | Restore time | Result |
|------|------|-----|--------------|--------|
| 2026-11-03 | `prod-2026-11-01.dump` | owner | n/a | Manual `pg_restore`, Strapi booted (steps not recorded). |
| 2026-11-18 | `prod-2026-11-01.dump` (463 KB, PG 16.13, includes form data) | Claude agent, local PG 17.2 | `pg_restore` about 1 s; Strapi `load()` about 9 s | 101 public tables restored; 18 articles, 22 files, 1 admin user; forms: contact 2 documents (4 rows), tour 0, transfer 8 documents (16 rows). Strapi booted clean (develop @ cf3d8ca). |
