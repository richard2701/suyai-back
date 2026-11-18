import type { Core } from '@strapi/strapi';

/**
 * Home fields replaced by the redesign (suyai-back#25). They stay in the schema and keep
 * resolving until the frontend stops querying them; removal is tracked as a follow-up.
 * Each entry is re-declared with its exact shadow-CRUD output type so the SDL merge only adds
 * the `@deprecated` directive and never changes the field type.
 */
export const HOME_DEPRECATED_FIELDS = [
  {
    field: 'cards',
    type: 'ComponentCommonsGridCards',
    reason: 'Use `destinations` instead (suyai-back#25).',
  },
  {
    field: 'contactForm',
    type: 'ComponentCommonsFormSection',
    reason: 'Use the `footer` single type contact fields instead (suyai-back#25).',
  },
  {
    field: 'footer',
    type: 'ComponentUtilsFooter',
    reason: 'Use the `footer` single type query instead (suyai-back#25).',
  },
] as const;

export const buildHomeDeprecationTypeDefs = (): string => {
  const fields = HOME_DEPRECATED_FIELDS.map(
    ({ field, type, reason }) => `  ${field}: ${type} @deprecated(reason: ${JSON.stringify(reason)})`,
  ).join('\n');
  return `type Home {\n${fields}\n}\n`;
};

export default {
  register({ strapi }: { strapi: Core.Strapi }): void {
    strapi
      .plugin('graphql')
      .service('extension')
      .use(() => ({ typeDefs: buildHomeDeprecationTypeDefs() }));
  },
};
