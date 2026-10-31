// Single middleware list for every environment. Strapi merges config/env/<env>/*.ts over
// config/*.ts with lodash _.merge, which merges ARRAYS BY INDEX, so a per-env override of the
// middleware list corrupts this one (duplicate strapi::security, bare strapi::cors). Keep all
// environment branching here and do NOT add config/env/*/middlewares.ts.
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Comma-separated list of exact SPA origins (no trailing slash), e.g. apex + www:
// FRONTEND_URL=https://example.com,https://www.example.com
const frontendOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (isProduction && frontendOrigins.length === 0) {
  throw new Error('FRONTEND_URL must be set in production (comma-separated exact SPA origins).');
}

// Max request body / upload size in bytes. Keep in sync with upload.sizeLimit in config/plugins.ts.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = '1mb';

// Dev-only: the Vite frontend's port varies (5173/5174/5175...), so a fixed allowlist entry
// breaks every time it changes. Echoes the request Origin only when it is
// http(s)://localhost:<port>, http(s)://127.0.0.1:<port> or Apollo Studio; returns false otherwise.
const isLocalDevOrigin = (origin: string | undefined): boolean =>
  !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOrigin = isDevelopment
  ? (ctx) => {
      const requestOrigin = ctx.get('Origin');
      return isLocalDevOrigin(requestOrigin) || requestOrigin === 'https://studio.apollographql.com'
        ? requestOrigin
        // Must be a string: strapi::cors calls .split() on non-array results; '' means no CORS header.
        : '';
    }
  : frontendOrigins;

const securityConfig = isProduction
  ? {
      // Strapi's default CSP already omits 'unsafe-inline' for script-src outside dev and the
      // admin panel works with it in production, so no script-src override is added here.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'res.cloudinary.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'res.cloudinary.com'],
          upgradeInsecureRequests: null,
        },
      },
    }
  : {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', 'apollo-server-landing-page.cdn.apollographql.com'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'apollo-server-landing-page.cdn.apollographql.com',
            'market-assets.strapi.io',
            'res.cloudinary.com',
          ],
          'script-src': ["'self'", "'unsafe-inline'", 'apollo-server-landing-page.cdn.apollographql.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'apollo-server-landing-page.cdn.apollographql.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'res.cloudinary.com'],
          'frame-src': ['sandbox.embed.apollographql.com'],
        },
      },
    };

export default [
  'strapi::errors',
  { name: 'strapi::security', config: securityConfig },
  {
    name: 'strapi::cors',
    config: {
      origin: corsOrigin,
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeadersOnError: true,
    },
  },
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: MAX_BODY_BYTES,
      jsonLimit: MAX_BODY_BYTES,
      textLimit: MAX_BODY_BYTES,
      formidable: { maxFileSize: MAX_UPLOAD_BYTES },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
