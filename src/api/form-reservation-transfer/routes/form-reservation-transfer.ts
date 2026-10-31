/**
 * form-reservation-transfer router
 */

import { factories } from '@strapi/strapi';

// Submissions go exclusively through the reCAPTCHA-protected GraphQL mutation,
// so no REST core routes are exposed (prevents captcha bypass and PII reads).
export default factories.createCoreRouter('api::form-reservation-transfer.form-reservation-transfer', {
  only: [],
});
