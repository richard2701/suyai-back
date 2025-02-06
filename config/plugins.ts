export default ({ env }) => ({
  graphql: {
    config: {
      endpoint: '/graphql',
      shadowCRUD: true,
      playgroundAlways: (strapi) => {
        if (env("NODE_ENV") !== "production") {
          return true;
        } else {
          return false;
        }
      },// disable Sandbox everywhere
      apolloServer: {
        tracing: true,
      },
      depthLimit: 7,
      amountLimit: 100,
    },
  },
});
