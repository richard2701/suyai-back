# Public permission and published-state audit (#97)

Run date: 2026-11-18, against https://api.transfersuyai.cl.

Re-run any time (read-only, no token needed):

```bash
node scripts/smoke-public-content.mjs
```

## Types read by villa-tour (`src/api/Queries.ts`)

| Query | Type | Public permission needed | Published content (2026-11-18) |
|-------|------|--------------------------|--------------------------------|
| GET_HOME_VIEWS, GET_HOME_NEW_FIELDS, GET_HOME_DESTINATIONS, GET_HERO_BUTTON_COLORS | home (single) | find | yes |
| GET_TRANSFER_VIEWS | transfer (single) | find | yes |
| GET_TRANSFER_VIEWS (infoData) | table-information | find | empty (section hidden) |
| GET_TOUR_VIEWS | tour (single) | find | yes |
| GET_TOUR_DETAIL | article | findOne (+ find for lists) | yes (9) |
| GET_TOUR_VIEWS / GET_TRANSFER_VIEWS (nested) | category | find | yes (2) |
| GET_NAVBAR | navbar (single) | find | yes |
| GET_FOOTER | footer (single) | find | yes |
| GET_GLOBAL | global (single) | find | yes |
| GET_TERMS_VIEW | term (single) | find | yes |
| GET_PRIVACY_VIEW | privacy (single) | find | yes |
| GET_MAGIC_BANNER | magic-banner (single) | find | **no entry** (section hidden) |
| GET_DESTINATIONS | destination | find | yes (5) |
| GET_TESTIMONIALS | testimonial | find | **empty** (section hidden) |
| CREATE_FORM_* | form-* | none (`auth: false` mutations) | n/a |

Every read permission above is granted. No read grant was missing.

## Write access

Public must be read-only on content. `role-permissions.ts` revokes Public `create`, `update` and
`delete` on every `api::*` type and `plugin::email.email.send` on every boot, and the smoke script
fails if an anonymous write probe is not answered with 403/404/405.

## Smoke result (GraphQL reads)

All required types ok; magicBanner, testimonials and tableInformations are empty (warning only,
the frontend hides those sections).
