# Contributing

## Branch naming convention

Every branch follows the pattern:

```
<type>/<issue-number>-<short-slug>
```

- **type** — derived from the issue's labels (see table below).
- **issue-number** — the GitHub issue this branch resolves.
- **short-slug** — a few kebab-case words from the issue title (≤ 5 words). Strip noise like `[S3]` tags and punctuation.

Examples:

```
feat/29-wire-services-cards-to-strapi
fix/35-fix-red-build-ts-errors
fix/9-unescaped-user-input-email-injection
refactor/14-triplicated-recaptcha-lifecycle
```

### Type prefixes

| Prefix | Purpose | Example |
| :-- | :-- | :-- |
| `feat/` | New features | `feat/user-avatar-upload` |
| `fix/` | Bug fixes | `fix/broken-submit-button` |
| `hotfix/` | Critical fixes in production | `hotfix/api-auth-exploit` |
| `chore/` | Maintenance, tooling, dependencies | `chore/bump-vite-version` |
| `style/` | Code style, formatting, linter | `style/fix-trailing-commas` |
| `refactor/` | Code optimization and restructuring | `refactor/rewrite-reducer` |
| `docs/` | Documentation changes only | `docs/api-endpoints` |
| `test/` | Adding or modifying tests | `test/mock-payment-gateway` |

### Picking the prefix from issue labels

First match wins, top to bottom:

| Issue labels | Prefix | Branch from |
| :-- | :-- | :-- |
| `bug`, `security`, `severity:*` | `fix/` | `develop` |
| `tech-debt`, `performance` | `refactor/` | `develop` |
| `config` (deploy / tooling / deps) | `chore/` | `develop` |
| `documentation` | `docs/` | `develop` |
| test-only changes | `test/` | `develop` |
| `feature`, `enhancement`, `design`, `seo`, `accessibility`, `animation` | `feat/` | `develop` |
| anything else | `feat/` | `develop` |

Security and high-severity issues still use `fix/` and go through `develop` — they're just prioritised higher (P0), not branched differently. Use `style/` for pure formatting / linter-only branches.

## Base branch & PRs

- Branch from **`develop`** for everything. Open pull requests **against `develop`**.
- `hotfix/` is the one exception, reserved for a genuine production emergency: branch from **`main`**, then back-merge to `develop`. It is not auto-assigned from labels — use it deliberately.
- Reference the issue in the PR body with `Closes #<number>` so it auto-closes on merge.
