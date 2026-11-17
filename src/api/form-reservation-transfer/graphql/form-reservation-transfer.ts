import { createFormResolver } from '../../../utils/create-form-resolver';
import { prepareTransferReservation } from '../../../utils/transfer-reservation';

export default createFormResolver({
  uid: 'api::form-reservation-transfer.form-reservation-transfer',
  mutation: 'createFormReservationTransfer',
  inputType: 'FormReservationTransferInput',
  fields: [
    'name',
    'lastname',
    'email',
    'phone',
    'message',
    'transferDate',
    'people',
    'destination',
    'pickupTime',
    'direction',
    'address',
    'placeId',
    'lat',
    'lng',
  ],
  // `destination` is still required, but it is derived from `address` when omitted.
  required: ['name', 'lastname', 'email', 'phone', 'transferDate', 'people', 'destination', 'pickupTime'],
  recaptchaAction: 'transfer_reservation',
  transform: prepareTransferReservation,
});
