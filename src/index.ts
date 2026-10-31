import formReservationTransfer from './api/form-reservation-transfer/graphql/form-reservation-transfer';
import formReservationTourExtension from './api/form-reservation-tour/graphql/form-reservation-tour';
import formContact from './api/form-contact/graphql/form-contact';
import { assertResendConfigured } from './utils/send-email';
import { createForcePublishedDocumentMiddleware } from './utils/publication-guard';

export default {
  register({ strapi }) {
    // Client IP resolution behind the proxy chain. config/server.ts sets `proxy.koa: true`, but
    // Strapi only forwards that flag to Koa, so by default ctx.ip is the LEFTMOST
    // X-Forwarded-For entry (client-controlled) and every per-IP limiter (form mutations,
    // admin login, users-permissions auth) can be bypassed by sending a fake header.
    // Production sits behind Cloudflare, which overwrites CF-Connecting-IP with the real client
    // address, so read only that header and only its last value. Without the header (local dev,
    // direct hits) Koa falls back to the socket address (koa/lib/request.js `get ip()`).
    // TODO(ops): verify once on Render by logging ctx.request.ips / ctx.ip for a known client;
    // if CF-Connecting-IP is absent there, set PROXY_IP_HEADER to the header Render guarantees.
    const koaApp = strapi.server.app;
    koaApp.proxyIpHeader = process.env.PROXY_IP_HEADER?.trim() || 'cf-connecting-ip';
    koaApp.maxIpsCount = 1;

    // Public content-API reads never return drafts (see src/utils/publication-guard.ts).
    strapi.documents.use(createForcePublishedDocumentMiddleware(strapi.requestContext));

    formReservationTransfer.register({ strapi });
    formReservationTourExtension.register({ strapi });
    formContact.register({ strapi });

    const shadowCRUD = strapi.plugin('graphql').service('extension').shadowCRUD;

    // Feature-flag tokens are managed only through their admin-gated REST
    // controller; never expose the type (or its plaintext tokens) via GraphQL.
    shadowCRUD('api::feature-flag-token.feature-flag-token').disable();

    // Public form submissions only need the reCAPTCHA-guarded create mutation.
    // Remove read/update/delete operations so a misconfigured role can never
    // leak or tamper with submitter PII, and drop `emailSent` from the input
    // type (it is server-managed). `emailSent` stays in the output type because
    // the frontend reads it from the create mutation response.
    const formUids = [
      'api::form-contact.form-contact',
      'api::form-reservation-tour.form-reservation-tour',
      'api::form-reservation-transfer.form-reservation-transfer',
    ] as const;
    for (const uid of formUids) {
      shadowCRUD(uid).disableActions(['find', 'findOne', 'update', 'delete']);
      shadowCRUD(uid).field('emailSent').disableInput();
    }

    // Legacy single type with PII fields; unused by the frontend.
    shadowCRUD('api::form.form').disable();
  },
  bootstrap() {
    // Email is lazily initialized (src/utils/send-email.ts) so local dev can
    // boot without a Resend key. Production doesn't get that grace period —
    // fail the deploy immediately if it's misconfigured, rather than only
    // discovering it when the first customer submits a reservation form.
    if (process.env.NODE_ENV === 'production') {
      assertResendConfigured();
    }
  },
};