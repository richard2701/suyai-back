import { createFormResolver } from '../../../utils/create-form-resolver';

export default createFormResolver({
  uid: 'api::form-reservation-transfer.form-reservation-transfer',
  mutation: 'createFormReservationTransfer',
  inputType: 'FormReservationTransferInput',
  fields: ['name', 'lastname', 'email', 'phone', 'message', 'transferDate', 'people', 'destination', 'pickupTime'],
  required: ['name', 'lastname', 'email', 'phone', 'transferDate', 'people', 'destination', 'pickupTime'],
  recaptchaAction: 'transfer_reservation',
});
