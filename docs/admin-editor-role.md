# Admin panel: branding, Spanish UI and the Editor role (suyai-back#90)

## What is in code

- `src/admin/app.tsx`: Suyai logo (login and menu), brand colors, Spanish texts for the login and
  menu header, Strapi tutorials and release notifications off.
- Spanish is the default admin language. The admin stores the language per browser
  (`localStorage['strapi-admin-language']`); `app.tsx` sets `es` only when nothing is stored, so a
  user who switches to English keeps it. A user's profile language (Profile > Interface language)
  wins at login.
- `favicon.png` (project root): Suyai favicon, served by the `strapi::favicon` middleware for the
  admin and the API domain.
- Content-type names in Spanish: only `info.displayName` in each `schema.json` changed.
  `singularName`, `pluralName` and `collectionName` did not change, so tables, REST routes and
  GraphQL type names are the same (checked with a GraphQL schema diff).

Rebuild the admin after changing any of these (`yarn build`, Render does it on deploy).

## Editor role (done in the admin UI, stored in the database)

Admin roles live in the database, so they are not in this repo. Strapi Community Edition ships a
built-in **Editor** role. Set it up once per environment (production and any restored DB):

1. Log in as Super Admin: `https://api.transfersuyai.cl/admin` (Cloudflare Access code, then
   Strapi login).
2. Configuración > Panel de administración > Roles > **Editor**.
3. Pestaña **Colecciones / Tipos únicos** (Content Manager): allow Create, Read, Update, Delete
   and Publish for the content editors work on: Página de tours, Tour (artículo), Destino,
   Testimonio, Inicio, Página de transfer, Pie de página, Barra de navegación, Banner destacado,
   Tabla de información, Términos y condiciones, Política de privacidad, Categoría, Autor.
4. Form submissions (Contacto, Reserva de tour, Reserva de transfer): allow **Read** only, so
   editors can see requests without editing or deleting them.
5. Leave unchecked: Token de vista previa, Formulario de tour (legacy), Configuración global
   (unless the owner wants editors to change SEO defaults).
6. Pestaña **Plugins**: leave Content-Type Builder, Users & Permissions, Email, Documentation
   and any feature-flags plugin unchecked. Media Library (Upload): allow, editors need images.
7. Pestaña **Configuración**: leave everything unchecked.
8. Save. Invite non-owner users from Configuración > Usuarios > Invitar usuario with the
   **Editor** role. Keep Super Admin for the owner only.

## Check

- Log in as an Editor user: the left menu shows Content Manager and Media Library only; there is
  no Content-Type Builder and no Configuración entry.
- Open `/admin/plugins/content-type-builder` directly as that user: access is denied.
