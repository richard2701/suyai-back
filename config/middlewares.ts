// Dev-only: the Vite frontend's port varies (5173/5174/5175...) depending on
// what else is running locally, so a fixed allowlist entry breaks every time
// it changes. Echoes back the request Origin (required by @koa/cors — see
// node_modules/@koa/cors) only when it's http(s)://localhost:<port> or
// http(s)://127.0.0.1:<port>; returns falsy otherwise, which makes @koa/cors
// skip the CORS headers entirely (request gets blocked, same as not being on
// the allowlist). Never used in production — see the ternary below.
const isLocalDevOrigin = (origin: string | undefined): boolean =>
  !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

// Production allowlist: FRONTEND_URL is a comma-separated list of exact origins.
// Entries are trimmed and blanks dropped, so an unset/empty FRONTEND_URL yields
// [] → @koa/cors returns no Access-Control-Allow-Origin for any request (fails
// closed), never a wildcard. Because this is an array of specific origins, an
// unlisted origin is rejected outright and credentials are never paired with '*'.
// Keep in sync with config/env/production/middlewares.ts.
const productionOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  {
    name: 'strapi::cors',
    config: {
      origin: process.env.NODE_ENV === 'development'
        ? (ctx) => {
            const requestOrigin = ctx.get('Origin');
            return isLocalDevOrigin(requestOrigin) || requestOrigin === 'https://studio.apollographql.com'
              ? requestOrigin
              : false;
          }
        : productionOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:", "apollo-server-landing-page.cdn.apollographql.com"],
          "img-src": ["'self'", "data:", "blob:", "apollo-server-landing-page.cdn.apollographql.com", "market-assets.strapi.io", "res.cloudinary.com"],
          "script-src": ["'self'", "'unsafe-inline'", "apollo-server-landing-page.cdn.apollographql.com"],
          "style-src": ["'self'", "'unsafe-inline'", "apollo-server-landing-page.cdn.apollographql.com"],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            'res.cloudinary.com',
          ],
          "frame-src": ["sandbox.embed.apollographql.com"]
        },
      },
    },
  },
];

