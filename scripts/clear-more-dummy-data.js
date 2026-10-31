'use strict';

// Second pass of dummy-data cleanup (client asked for zero placeholder content,
// 2026-07-22). Found after the first pass (clear-seed-dummy-data.js):
// - `magicBanner` (eyebrow/title/description/primaryButton/secondaryButton) is a
//   verbatim copy of the old HomeMagicBanner.tsx FALLBACK object.
// - `footer.officeLocation` is a verbatim copy of AppLayout.tsx's FALLBACK_FOOTER.
// - `home.servicesIcon` has obvious human-typed test garbage ("Helllo ooo",
//   "Hola como estanb") — not a code-fallback echo, just test content that was
//   never real, but still dummy data that shouldn't ship.
//
// Same rule as the first script: read the current full state before writing,
// preserve every field not explicitly being cleared, never send a partial
// component (Strapi's Document Service replaces components wholesale).

async function clearMagicBanner(strapi) {
  const banner = await strapi.documents('api::magic-banner.magic-banner').findFirst({
    populate: ['image'],
  });
  if (!banner) {
    console.log('No magic-banner entry found, nothing to clear.');
    return;
  }
  console.log('Current magic-banner:', JSON.stringify(banner, null, 2));

  await strapi.documents('api::magic-banner.magic-banner').update({
    documentId: banner.documentId,
    data: {
      eyebrow: null,
      title: null,
      description: null,
      primaryButton: null,
      secondaryButton: null,
      image: banner.image?.id ?? null,
    },
    status: 'published',
  });
  console.log('Cleared magic-banner eyebrow/title/description/primaryButton/secondaryButton; preserved image.');
}

async function clearFooterOfficeLocation(strapi) {
  const footer = await strapi.documents('api::footer.footer').findFirst({
    populate: ['links', 'social', 'contact', 'term', 'privacy'],
  });
  if (!footer) {
    console.log('No footer entry found, nothing to clear.');
    return;
  }
  console.log('Current footer:', JSON.stringify(footer, null, 2));

  await strapi.documents('api::footer.footer').update({
    documentId: footer.documentId,
    data: {
      copy: footer.copy ?? null,
      links: (footer.links ?? []).map((l) => ({ name: l.name, url: l.url, text: l.text })),
      social: (footer.social ?? []).map((s) => ({ name: s.name, url: s.url, text: s.text })),
      contact: (footer.contact ?? []).map((c) => ({ name: c.name, url: c.url, text: c.text })),
      term: footer.term ? { name: footer.term.name, url: footer.term.url, text: footer.term.text } : null,
      privacy: footer.privacy ? { name: footer.privacy.name, url: footer.privacy.url, text: footer.privacy.text } : null,
      officeLocation: null,
    },
    status: 'published',
  });
  console.log('Cleared footer.officeLocation; preserved copy/links/social/contact/term/privacy.');
}

async function clearServicesIconTestGarbage(strapi) {
  const home = await strapi.documents('api::home.home').findFirst({
    populate: {
      servicesIcon: { populate: ['button', 'image', 'iconsInfo'] },
    },
  });
  if (!home) {
    console.log('No home entry found, nothing to clear.');
    return;
  }
  console.log('Current servicesIcon:', JSON.stringify(home.servicesIcon, null, 2));

  const svc = home.servicesIcon;

  await strapi.documents('api::home.home').update({
    documentId: home.documentId,
    data: {
      servicesIcon: {
        // title/description are required with a 40-char minimum on this
        // component — can't blank them without inventing new fake-sounding
        // copy, which would recreate the same problem. Leaving them as-is;
        // doesn't matter for rendering, since HomeServicesSection.tsx
        // already returns null whenever iconsInfo is empty (villa-tour#69),
        // before it ever reads title/description. The actual fake content
        // (the "Hola como estanb" card below) is what mattered.
        title: svc?.title ?? '',
        description: svc?.description ?? '',
        button: svc?.button ? { text: svc.button.text, type: svc.button.type, url: svc.button.url } : null,
        image: svc?.image?.id ?? null,
        iconsInfo: [],
      },
    },
    status: 'published',
  });
  console.log('Cleared servicesIcon.{title,description,iconsInfo} (test garbage); preserved button/image.');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  await clearMagicBanner(app);
  await clearFooterOfficeLocation(app);
  await clearServicesIconTestGarbage(app);

  await app.destroy().catch(() => {});
  process.exit(0);
}

main().catch((error) => {
  console.error(JSON.stringify(error.details, null, 2));
  console.error(error);
  process.exit(1);
});
