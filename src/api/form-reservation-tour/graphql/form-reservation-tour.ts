import { createFormResolver } from '../../../utils/create-form-resolver';

export default createFormResolver({
  uid: 'api::form-reservation-tour.form-reservation-tour',
  mutation: 'createFormReservationTour',
  inputType: 'FormReservationTourInput',
  fields: ['name', 'lastname', 'email', 'phone', 'message', 'tourDate', 'tourName', 'tourId', 'people', 'article'],
  required: ['name', 'lastname', 'email', 'phone', 'tourName', 'tourDate', 'people'],
  recaptchaAction: 'tour_reservation',
});
