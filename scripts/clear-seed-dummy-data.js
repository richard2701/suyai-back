'use strict';

// One-off cleanup script: reverts the placeholder content that scripts/seed.js /
// scripts/seed-testimonials.js copied verbatim from the old frontend hardcoded
// fallbacks (front/src/components/home/HomeHero.tsx, HomeAbout.tsx,
// HomeReviews.tsx) into real CMS entries. That made the "hide when empty"
// frontend fix (villa-tour#69/#70) invisible, since the "empty" fields were
// never actually empty — they held copy-pasted placeholder text presented as
// real content. Client explicitly asked for zero dummy data, 2026-07-22.
// Same createStrapi/compileStrapi bootstrap as the other one-off scripts here.
//
// Nulls only the fields that matched the old hardcoded fallback values
// verbatim (yearsInBusiness, stats, hero.badge/trustBullets/rating/
// travelerCount) and deletes the 3 seeded testimonials. Leaves real/manually-
// entered content (title/subtitle/description/images/avatars) untouched.

async function clearHomeDummyFields(strapi) {
  // IMPORTANT: Strapi's Document Service replaces a component wholesale on
  // update — it does NOT merge with existing sub-fields. Any field left out
  // of the `aboutUs`/`hero` payload below gets wiped, not left alone. So this
  // reads the current component state first and re-sends every field,
  // nulling only the known-dummy ones. (An earlier version of this script
  // skipped this step and wiped real title/subtitle/description/images —
  // don't repeat that mistake.)
  const home = await strapi.documents('api::home.home').findFirst({
    fields: ['documentId'],
    populate: {
      aboutUs: { populate: ['images'] },
      hero: { populate: ['image', 'avatars', 'button'] },
    },
  });

  if (!home) {
    console.log('No home entry found, nothing to clear.');
    return;
  }

  const { aboutUs, hero } = home;

  await strapi.documents('api::home.home').update({
    documentId: home.documentId,
    data: {
      aboutUs: {
        title: aboutUs?.title ?? null,
        subtitle: aboutUs?.subtitle ?? null,
        description: aboutUs?.description ?? null,
        images: (aboutUs?.images ?? []).map((img) => img.id),
        stats: [],
        yearsInBusiness: null,
      },
      hero: {
        title: hero?.title ?? null,
        description: hero?.description ?? null,
        size: hero?.size ?? null,
        image: hero?.image?.id ?? null,
        button: hero?.button ? { text: hero.button.text, type: hero.button.type, url: hero.button.url } : null,
        avatars: (hero?.avatars ?? []).map((a) => a.id),
        badge: null,
        trustBullets: [],
        rating: null,
        travelerCount: null,
      },
    },
    // Strapi 5's Document Service writes a draft revision by default; without
    // this the public GraphQL API (which serves the published version) keeps
    // returning the stale values — same gotcha documented in seed-testimonials.js.
    status: 'published',
  });

  console.log('Cleared aboutUs.{stats,yearsInBusiness} and hero.{badge,trustBullets,rating,travelerCount}; preserved everything else.');
}

async function deleteSeededTestimonials(strapi) {
  const SEEDED_NAMES = ['María José Fernández', 'Lukas Hoffmann', 'Andrés Rojas'];

  for (const authorName of SEEDED_NAMES) {
    const existing = await strapi.query('api::testimonial.testimonial').findOne({
      where: { authorName },
    });

    if (!existing) {
      console.log(`Not found (already removed?): ${authorName}`);
      continue;
    }

    await strapi.documents('api::testimonial.testimonial').delete({
      documentId: existing.documentId,
    });
    console.log(`Deleted seeded testimonial: ${authorName}`);
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await clearHomeDummyFields(app);
  await deleteSeededTestimonials(app);

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
