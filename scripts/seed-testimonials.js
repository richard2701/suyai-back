'use strict';

// One-off script to seed the 3 testimonials currently hardcoded in the
// frontend (front/src/components/home/HomeReviews.tsx, the REVIEWS[] array)
// into the api::testimonial.testimonial collection (suyai-back#20).
// Follows the same createStrapi/compileStrapi bootstrap used in
// scripts/grant-permissions.js. Idempotent: skips a testimonial when one with
// the same authorName already exists. The `photo` field is left empty on
// purpose — the frontend used external Unsplash URLs that are not real
// uploads; editors can attach a media photo per testimonial in the admin.

const TESTIMONIALS = [
  {
    text:
      'Suyai organizó nuestro traslado al aeropuerto Araucanía y fue perfecto. ' +
      'El conductor llegó puntual, el vehículo estaba impecable y el precio era justo. ' +
      'Lo volvería a contratar sin dudarlo.',
    authorName: 'María José Fernández',
    authorRole: 'Viajera frecuente',
    rating: 5.0,
    order: 1,
    featured: true,
  },
  {
    text:
      'Reservé un tour a las termas de última hora y todo salió perfecto. ' +
      'Guía bilingüe, minivan cómoda, paisajes increíbles. ¡El sur de Chile vale cada peso!',
    authorName: 'Lukas Hoffmann',
    authorRole: 'Turista alemán',
    rating: 4.8,
    order: 2,
    featured: true,
  },
  {
    text:
      'Viajamos en familia con tres niños y Suyai lo hizo todo muy sencillo. ' +
      'Vehículo con silla de niño, mucha paciencia y un recorrido por Pucón que nunca olvidaremos.',
    authorName: 'Andrés Rojas',
    authorRole: 'Padre de familia',
    rating: 5.0,
    order: 3,
    featured: true,
  },
];

async function seedTestimonials() {
  for (const testimonial of TESTIMONIALS) {
    const existing = await strapi.query('api::testimonial.testimonial').findOne({
      where: { authorName: testimonial.authorName },
    });

    if (existing) {
      console.log(`Already seeded: ${testimonial.authorName}`);
      continue;
    }

    await strapi.documents('api::testimonial.testimonial').create({
      data: testimonial,
      // Strapi 5's Document Service publishes via `status`, not by setting
      // `publishedAt` in `data` (that field is ignored on create) — without
      // this the entry is created as a draft and Public find/findOne never
      // returns it.
      status: 'published',
    });
    console.log(`Seeded: ${testimonial.authorName}`);
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedTestimonials();

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
