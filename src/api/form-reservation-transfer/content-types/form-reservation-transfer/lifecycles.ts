import { createFormLifecycle } from '../../../../utils/create-form-lifecycle';
import { buildTransferEmailVars, fillDestinationFromAddress } from '../../../../utils/transfer-reservation';

const formLifecycle = createFormLifecycle({
  uid: 'api::form-reservation-transfer.form-reservation-transfer',
  submitter: { template: 'reservation_transfer.html', subject: 'Reservacion Transfer' },
  admin: { template: 'reservation_transfer_copy.html', subject: 'Reservacion Transfer Copía' },
  buildVars: buildTransferEmailVars,
});

export default {
  ...formLifecycle,
  // Safety net for entries created outside the public mutation (REST, scripts, admin).
  beforeCreate(event: { params: { data?: Record<string, unknown> } }) {
    if (event.params.data) {
      event.params.data = fillDestinationFromAddress(event.params.data);
    }
  },
};
