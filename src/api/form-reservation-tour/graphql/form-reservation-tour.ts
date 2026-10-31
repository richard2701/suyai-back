import { validateRecaptcha } from '../services/recaptcha';
import { pickFields } from '../../../utils/pick-fields';
import { formRateLimitMiddleware } from '../../../utils/form-rate-limit';
import { assertValidFormInput } from '../../../utils/form-validation';

// Fields a public visitor may submit (mirrors the FE mutation payload).
// Server-managed fields such as `emailSent` are intentionally excluded.
const TOUR_RESERVATION_FIELDS = ['name', 'lastname', 'email', 'phone', 'message', 'tourDate', 'tourName', 'tourId', 'people', 'article'] as const;

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
          // Per-IP limit, applied before the resolver (and therefore before reCAPTCHA).
          middlewares: [formRateLimitMiddleware],
        },
      },
      resolvers: {
        Mutation: {
          createFormReservationTour: {
            resolve: async (parent, args, context) => {
              const { data } = args;
              const { recaptchaToken } = data;
              // Trim + length/URL/format checks before the billed reCAPTCHA call.
              const formData = assertValidFormInput(pickFields(data, TOUR_RESERVATION_FIELDS));

              // verify token with reCAPTCHA
              if (!recaptchaToken) {
                throw new Error('reCAPTCHA token is required');
              }
              const isValid = await validateRecaptcha(recaptchaToken, 'tour_reservation');
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

