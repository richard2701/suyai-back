import { validateRecaptcha } from '../services/recaptcha';
export default {
  register({ strapi }) {
    const extensionService = strapi.plugin('graphql').service('extension');

    extensionService.use(({ nexus }) => ({

      typeDefs: `
        extend input FormReservationTourInput {
          recaptchaToken: String!
        }
      `,
      resolversConfig: {
        'Mutation.createFormReservationTour': {
          auth: false,
        },
      },
      resolvers: {
        Mutation: {
          createFormReservationTour: {
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

              const requiredFields = ['name', 'lastname', 'email', 'phone', 'tourName', 'tourDate', 'people'];
              for (const field of requiredFields) {
                if (!formData[field]) {
                  throw new Error(`El campo ${field} es requerido.`);
                }
              }

              const response = await strapi.services['api::form-reservation-tour.form-reservation-tour'].create({ data: formData });
              return response;
            }
          },
        },
      },
    }));
  },
};

