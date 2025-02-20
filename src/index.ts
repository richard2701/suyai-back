import formReservationTourExtension from './api/form-reservation-tour/graphql/form-reservation-tour';

export default {
  register({ strapi }) {
    formReservationTourExtension.register({ strapi });
  },
};