# Strapi roles hardening checklist (BE #60)

The site has no end-user accounts, so Public and Authenticated roles must stay least-privilege.

## Enforced in code

`src/utils/role-permissions.ts`, called from `bootstrap()` in `src/index.ts`, runs on every boot and:

- Revokes from **Public and Authenticated**: any action on `form-contact`, `form-reservation-tour`,
  `form-reservation-transfer`, `form`, `feature-flag-token`, every `plugin::upload.*` action,
  and `users-permissions` `user.find` / `user.findOne`.
- Revokes from **Public**: `auth.register`, `auth.connect`, `auth.forgotPassword`.
- Sets users-permissions advanced setting `allow_register` to `false`.
- Logs the remaining Authenticated grants (`[permissions] authenticated grants kept (review)`) so they can be reviewed.

Form submissions are unaffected: the 3 form mutations are `auth: false` GraphQL mutations.

## Manual verification after deploy (production)

Admin: https://suyai-app.onrender.com/admin -> Settings -> Users & Permissions plugin.

- [ ] Roles -> Public: only read (`find`/`findOne`) on content the SPA needs; nothing on forms, upload, users
- [ ] Roles -> Authenticated: nothing beyond what the boot log lists as kept
- [ ] Advanced Settings: "Enable sign-ups" is off
- [ ] Render logs for the deploy contain `[permissions] ...` lines (revocations on first boot, none after)

## Black-box checks

```bash
# registration rejected (expect 400/403/404, never 200)
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/api/auth/local/register \
  -H 'content-type: application/json' -d '{"username":"x","email":"x@x.cl","password":"Abcd1234!"}'

# no anonymous reads of submissions, uploads or users (expect 403/404)
curl -s -o /dev/null -w "%{http_code}\n" $API/api/form-contacts
curl -s -o /dev/null -w "%{http_code}\n" $API/api/users

# drafts not public (expect no draft documents)
curl -s "$API/api/articles?status=draft"
curl -s -X POST $API/graphql -H 'content-type: application/json' \
  -d '{"query":"{ articles(status: DRAFT) { documentId } }"}'
```

- [ ] All 3 forms (contact, tour reservation, transfer) still submit successfully
