import { forcePublishedApolloPlugin } from '../src/utils/publication-guard';

export default ({ env }) => ({
  graphql: {
    config: {
      endpoint: '/graphql',
      shadowCRUD: true,
      landingPage: (strapi) => {
        if (env("NODE_ENV") !== "production") {
          return true;
        } else {
          return false;
        }
      },// disable Sandbox everywhere
      depthLimit: 7,
      // Only apolloServer options reach Apollo; top-level playground/introspection are ignored.
      apolloServer: {
        introspection: env('NODE_ENV') !== 'production',
        // Disable the plugin's default permissive route-level cors() so the global
        // strapi::cors allowlist (config/middlewares.ts) is the only CORS policy on /graphql.
        cors: false,
        // Disable Automatic Persisted Queries: hash-only requests carry no query text and
        // there is no client that uses APQ. Passed straight through to ApolloServer.
        persistedQueries: false,
        // Appended after plugin-graphql's own plugins (arrays are concatenated): stops public
        // callers from reading drafts via `status: DRAFT`, including nested relations.
        plugins: [forcePublishedApolloPlugin],
      },
      defaultLimit: 100,
      maxLimit: 100,
    },
  },
  upload: {
    config: {
      sizeLimit: 10 * 1024 * 1024, // bytes; keep in sync with strapi::body formidable.maxFileSize
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_NAME'),
        api_key: env('CLOUDINARY_KEY'),
        api_secret: env('CLOUDINARY_SECRET'),
        folder: env('CLOUDINARY_FOLDER'),
      },
      actionOptions: {
        uploadStream: {
          folder: env('CLOUDINARY_FOLDER'), // Ensure this matches the folder name you want
        },
        upload: {},
        delete: {},
      },
    },
  },
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.resend.com'),
        port: env.int('SMTP_PORT', 465),
        secure: env.bool('SMTP_SECURE', true),
        auth: {
          user: env('SMTP_USERNAME', 'resend'),
          pass: env('RESEND_API_KEY'),
        },
      },
      settings: {
        defaultFrom: env('SMTP_FROM'),
        defaultReplyTo: env('SMTP_FROM'),
      },
    },
  },
  seo: {
    enabled: true,
  },
  'feature-flags': {
    enabled: true,
    resolve: './src/plugins/feature-flags',
  },
});
