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
        ? ['https://studio.apollographql.com', 'http://localhost:1337'] // Development origins
        : [process.env.FRONTEND_URL],
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
          'script-src': ["'self'", 'https://cdn.ckeditor.com', process.env.APOLLO_CDN ? process.env.APOLLO_CDN : ""].filter(Boolean),
          'connect-src': ['https://proxy-event.ckeditor.com', 'https://studio.apollographql.com', "'self'", "https:", process.env.APOLLO_CDN ? process.env.APOLLO_CDN : ""].filter(Boolean),
          "img-src": ["'self'", "data:", "blob:", process.env.APOLLO_CDN ? process.env.APOLLO_CDN : ""].filter(Boolean),
          "style-src": ["'self'", process.env.APOLLO_CDN ? process.env.APOLLO_CDN : ""].filter(Boolean),
          "frame-src": ["sandbox.embed.apollographql.com"],
        },
      },
    },
  },
];

