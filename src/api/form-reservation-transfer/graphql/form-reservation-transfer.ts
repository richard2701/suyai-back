import { validateRecaptcha } from '../services/recaptcha';
export default {
  register({ strapi }) {
    const extensionService = strapi.plugin('graphql').service('extension');

    extensionService.use(({ nexus }) => ({

      typeDefs: `
        extend input FormReservationTransferInput {
          recaptchaToken: String!
        }
      `,
      resolversConfig: {
        'Mutation.createFormReservationTransfer': {
          auth: false,
        },
      },
      resolvers: {
        Mutation: {
          createFormReservationTransfer: {
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

              const requiredFields = ['name', 'lastname', 'email', 'phone', 'transferDate', 'people'];
              for (const field of requiredFields) {
                if (!formData[field]) {
                  throw new Error(`El campo ${field} es requerido.`);
                }
              }

              const response = await strapi.services['api::form-reservation-transfer.form-reservation-transfer'].create({ data: formData });
              return response;
            }
          },
        },
      },
    }));
  },
};

