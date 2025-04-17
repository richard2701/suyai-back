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
      playground: true, // Enable the GraphQL playground
      introspection: true, // Allow introspection queries
      defaultLimit: 100, // Default limit for queries
      maxLimit: 500
    },
  },
  upload: {
    config: {
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
      provider: 'sendgrid', // For community providers pass the full package name (e.g. provider: 'strapi-provider-email-mandrill')
      providerOptions: {
        apiKey: env('SMTP_APIKEY'),
      },
      settings: {
        defaultFrom: env('SMTP_EMAIL'),
        defaultReplyTo: env('SMTP_EMAIL'),
      },
    },
  },
  seo: {
    enabled: true,
  },
});
