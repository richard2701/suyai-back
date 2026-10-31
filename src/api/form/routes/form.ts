/**
 * form router
 */

import { factories } from '@strapi/strapi';

// Legacy single type holding PII fields; unused by the frontend, so no REST
// core routes are exposed.
export default factories.createCoreRouter('api::form.form', {
  only: [],
});
