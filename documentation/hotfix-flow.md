# Hotfix Flow — Worktree-based

**Script:** `scripts/hotfix.ps1`
**Stack:** Strapi 5 / TypeScript, shared local PostgreSQL (`suyai_bd`), dev server on `PORT=1337`.

> Use this when an urgent fix lands while you're mid-feature and your main
> `npm run develop` is running. A worktree gives you an isolated working tree +
> a second dev server **without** stopping your current work or stashing.

---

## TL;DR

```powershell
./scripts/hotfix.ps1 new <name>          # create worktree on hotfix/<name> @ :1338
cd ../back-hotfix-<name>
npm run develop                          # http://localhost:1338/admin
# fix → commit → push → PR
cd ../back
./scripts/hotfix.ps1 done <name>         # remove worktree, KEEP branch for the PR
```

---

## Commands

| Command | What it does |
|---------|--------------|
| `new <name>` | Fetches `origin`, creates worktree `../back-hotfix-<name>` on branch `hotfix/<name>` from `origin/main`, wires up `.env` + `node_modules`. |
| `done <name>` | Removes the worktree (and its `node_modules` junction). **Branch is kept** so its PR survives. |
| `list` | `git worktree list` — show active worktrees. |

### Flags (for `new`)

| Flag | Default | Purpose |
|------|---------|---------|
| `-Port <n>` | `1338` | Port for the worktree's dev server (so it runs alongside `:1337`). |
| `-Install` | off | Run a clean `npm install` instead of junction-linking `node_modules`. Use when the hotfix needs a new/changed dependency. |
| `-Base <ref>` | `origin/main` | Branch the hotfix off something other than `origin/main`. |

---

## What it handles (project-specific gotchas)

- **`.env` is gitignored** → copied into the worktree, with `PORT` rewritten to `-Port`
  so both servers run at once.
- **`node_modules` is gitignored and Strapi is heavy** → junction-linked from the main
  repo (instant, zero extra GB). `done` removes only the link, never the real folder.
- **Shared local PostgreSQL (`suyai_bd`)** → the worktree hits the **same DB** as your
  main server. Good for a hotfix (real data), with one caveat below.

---

## ⚠️ Caveats

- **No schema/content-type changes in a hotfix worktree.** Two Strapi instances
  against one PostgreSQL DB will fight over migrations. Keep hotfixes to code
  (controllers, services, lifecycles, templates) — not content-type definitions.
- **Junction assumes deps match `main`.** If the fix adds or bumps a package, run
  `new` with `-Install` so the worktree gets its own real `node_modules`.
- Worktrees live as siblings: `D:\Projects\suyai\back-hotfix-<name>`.

---

## Manual fallback

If the script is unavailable:

```powershell
git fetch origin
git worktree add -b hotfix/x ../back-hotfix-x origin/main
Copy-Item .env ../back-hotfix-x/.env          # then edit PORT
New-Item -ItemType Junction -Path ../back-hotfix-x/node_modules -Target ./node_modules
# ... work ...
cmd /c rmdir ../back-hotfix-x/node_modules    # drop junction first
git worktree remove ../back-hotfix-x --force
```
