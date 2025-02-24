import formReservationTransfer from './api/form-reservation-transfer/graphql/form-reservation-transfer';
import formReservationTourExtension from './api/form-reservation-tour/graphql/form-reservation-tour';
import formContact from './api/form-contact/graphql/form-contact';

export default {
  register({ strapi }) {
    formReservationTransfer.register({ strapi });
    formReservationTourExtension.register({ strapi });
    formContact.register({ strapi });
  },
};