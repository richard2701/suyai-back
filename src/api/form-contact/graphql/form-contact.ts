import { validateRecaptcha } from '../services/recaptcha';
export default {
  register({ strapi }) {
    const extensionService = strapi.plugin('graphql').service('extension');

    extensionService.use(({ nexus }) => ({

      typeDefs: `
        extend input FormContactInput {
          recaptchaToken: String!
        }
      `,
      resolversConfig: {
        'Mutation.createFormContact': {
          auth: false,
        },
      },
      resolvers: {
        Mutation: {
          createFormContact: {
            resolve: async (parent, args, context) => {
              const { data } = args;
              const { recaptchaToken, ...formData } = data;

              // verify token with reCAPTCHA
              if (!recaptchaToken) {
                throw new Error('reCAPTCHA token is required');
              }
              const isValid = await validateRecaptcha(recaptchaToken, 'tourReservation');
              if (!isValid) {
                throw new Error('reCAPTCHA inválido.');
              }

              const requiredFields = ['name', 'lastname', 'email', 'phone'];
              for (const field of requiredFields) {
                if (!formData[field]) {
                  throw new Error(`El campo ${field} es requerido.`);
                }
              }

              const response = await strapi.services['api::form-contact.form-contact'].create({ data: formData });
              return response;
            }
          },
        },
      },
    }));
  },
};

