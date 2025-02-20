import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::form-reservation-tour.form-reservation-tour');
/* 
export default factories.createCoreController('api::form-reservation-tour.form-reservation-tour', ({ strapi }) => ({
  async create(ctx) {
    const { recaptchaToken, ...formData } = ctx.request.body.data;

    if (!recaptchaToken) {
      return ctx.badRequest('reCAPTCHA token es requerido');
    }

    // 🔥 Validar el token con Google reCAPTCHA Enterprise
    const isValid = await validateRecaptcha(recaptchaToken, 'tourReservation');
    if (!isValid) {
      return ctx.unauthorized('reCAPTCHA inválido');
    }
    console.log('Token válido');
    // ✅ Si el token es válido, crear la reserva en Strapi
    const response = await strapi.service('api::form-reservation-tour.form-reservation-tour').create({ data: formData });

    return response;
  },
})); */

/**
 * 🔥 Función para validar el reCAPTCHA Enterprise
 */
/* async function validateRecaptcha(token, userAction) {
  const apiKey = process.env.RECAPTCHA_API_KEY; // ⚠️ Define esta clave en tu `.env`
  const projectId = process.env.RECAPTCHA_PROJECT_ID; // ⚠️ Agrega tu ID de proyecto de Google Cloud
  const siteKey = process.env.RECAPTCHA_SECRET_KEY; // ⚠️ Define tu siteKey de reCAPTCHA

  const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          token,
          expectedAction: userAction, // 🔥 Debe coincidir con la acción enviada desde el frontend
          siteKey,
        },
      }),
    });

    const data: { riskAnalysis?: { score: number }, tokenProperties?: { valid: boolean } } = await response.json();

    // 🔍 Verificar si el token es válido
    return data.riskAnalysis?.score >= 0.5 && data.tokenProperties?.valid;
  } catch (error) {
    console.error('Error validando reCAPTCHA:', error);
    return false;
  }
} */
