'use strict';

// One-off script to grant Public find/findOne on the new magic-banner and
// testimonial content-types (suyai-back#48). Follows the same
// setPublicPermissions pattern already used in scripts/seed.js. Safe to
// re-run — skips permissions that already exist.

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

  await setPublicPermissions({
    'magic-banner': ['find'],
    testimonial: ['find', 'findOne'],
  });

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
