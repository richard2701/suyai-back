import { GraphQLError } from 'graphql';
import { validateRecaptcha } from './recaptcha';
import { pickFields } from './pick-fields';
import { formRateLimitMiddleware } from './form-rate-limit';
import { assertValidFormInput } from './form-validation';

export interface FormResolverConfig {
  /** Content-type UID, e.g. `api::form-contact.form-contact`. */
  uid: string;
  /** GraphQL mutation name, e.g. `createFormContact`. */
  mutation: string;
  /** GraphQL input type name, e.g. `FormContactInput`. */
  inputType: string;
  /** Fields a public visitor may submit. Server-managed fields (e.g. `emailSent`) must be excluded. */
  fields: readonly string[];
  /** Fields that must be non-empty after validation. */
  required: readonly string[];
  /** reCAPTCHA action the frontend must use for this form. */
  recaptchaAction: string;
}

// GraphQLError passes through plugin-graphql's formatError unchanged; a plain Error is masked
// as a generic "Internal Server Error", so the frontend would never see the reason.
const userError = (message: string, code: string): GraphQLError =>
  new GraphQLError(message, { extensions: { code } });

/**
 * Builds the Strapi `register` hook for a public form mutation:
 * rate limit -> allowlist + validation -> reCAPTCHA -> required fields -> create.
 *
 * The entity is re-fetched after creation because the `afterCreate` lifecycle sends the emails
 * and flips `emailSent` after `create` resolves; returning the create result would always
 * report `emailSent: false`.
 */
export const createFormResolver = (config: FormResolverConfig) => ({
  register({ strapi }) {
    const extensionService = strapi.plugin('graphql').service('extension');

    extensionService.use(() => ({
      typeDefs: `
        extend input ${config.inputType} {
          recaptchaToken: String!
        }
      `,
      resolversConfig: {
        [`Mutation.${config.mutation}`]: {
          auth: false,
          // Per-IP limit, applied before the resolver (and therefore before reCAPTCHA).
          middlewares: [formRateLimitMiddleware],
        },
      },
      resolvers: {
        Mutation: {
          [config.mutation]: {
            resolve: async (_parent: unknown, args: { data: Record<string, unknown> }) => {
              const { data } = args;
              const recaptchaToken = data.recaptchaToken as string | undefined;
              // Trim + length/URL/format checks before the billed reCAPTCHA call.
              const formData = assertValidFormInput(pickFields(data, config.fields));

              if (!recaptchaToken) {
                throw userError('reCAPTCHA token is required', 'RECAPTCHA_REQUIRED');
              }
              if (!(await validateRecaptcha(recaptchaToken, config.recaptchaAction))) {
                throw userError('reCAPTCHA inválido.', 'RECAPTCHA_FAILED');
              }

              for (const field of config.required) {
                if (!formData[field]) {
                  throw userError(`El campo ${field} es requerido.`, 'BAD_USER_INPUT');
                }
              }

              const created = await strapi.services[config.uid].create({ data: formData });
              const refreshed = await strapi
                .documents(config.uid)
                .findOne({ documentId: created.documentId });
              return refreshed ?? created;
            },
          },
        },
      },
    }));
  },
});
