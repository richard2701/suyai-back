import formReservationTransfer from './api/form-reservation-transfer/graphql/form-reservation-transfer';
import formReservationTourExtension from './api/form-reservation-tour/graphql/form-reservation-tour';
import formContact from './api/form-contact/graphql/form-contact';
import { assertResendConfigured } from './utils/send-email';

export default {
  register({ strapi }) {
    formReservationTransfer.register({ strapi });
    formReservationTourExtension.register({ strapi });
    formContact.register({ strapi });
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