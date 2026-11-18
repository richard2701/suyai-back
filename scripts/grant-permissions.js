'use strict';

// Grants Public find/findOne on every content-type the frontend reads
// (suyai-back#48, extended in #97). Follows the same setPublicPermissions
// pattern already used in scripts/seed.js. Safe to re-run: skips permissions
// that already exist. Verify with scripts/smoke-public-content.mjs.

async function setPublicPermissions(newPermissions) {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  for (const controller of Object.keys(newPermissions)) {
    for (const action of newPermissions[controller]) {
      const actionName = `api::${controller}.${controller}.${action}`;
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action: actionName, role: publicRole.id },
      });
      if (existing) {
        console.log(`Already granted: ${actionName}`);
        continue;
      }
      await strapi.query('plugin::users-permissions.permission').create({
        data: { action: actionName, role: publicRole.id },
      });
      console.log(`Granted: ${actionName}`);
    }
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  // Read-only grants for every type villa-tour queries (suyai-back#97). Single types only
  // have `find`. Never add write actions here: role-permissions.ts revokes them on boot.
  await setPublicPermissions({
    home: ['find'],
    transfer: ['find'],
    tour: ['find'],
    global: ['find'],
    navbar: ['find'],
    footer: ['find'],
    term: ['find'],
    privacy: ['find'],
    'magic-banner': ['find'],
    article: ['find', 'findOne'],
    category: ['find', 'findOne'],
    author: ['find', 'findOne'],
    destination: ['find', 'findOne'],
    testimonial: ['find', 'findOne'],
    'table-information': ['find', 'findOne'],
  });

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
