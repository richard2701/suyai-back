import { createFormLifecycle } from '../../../../utils/create-form-lifecycle';

export default createFormLifecycle({
  uid: 'api::form-reservation-transfer.form-reservation-transfer',
  submitter: { template: 'reservation_transfer.html', subject: 'Reservacion Transfer' },
  admin: { template: 'reservation_transfer_copy.html', subject: 'Reservacion Transfer Copía' },
  buildVars: (result) => ({
    name: result.name,
    lastname: result.lastname,
    email: result.email,
    phone: result.phone,
    message: result.message,
    transferDate: result.transferDate,
    people: result.people,
    destination: result.destination,
    pickupTime: result.pickupTime,
  }),
});
