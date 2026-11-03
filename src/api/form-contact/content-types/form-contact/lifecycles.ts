import { createFormLifecycle } from '../../../../utils/create-form-lifecycle';

export default createFormLifecycle({
  uid: 'api::form-contact.form-contact',
  submitter: { template: 'contact.html', subject: 'Contacto recibido' },
  admin: { template: 'contact_copy.html', subject: 'Contacto Copía' },
  buildVars: (result) => ({
    name: result.name,
    lastname: result.lastname,
    email: result.email,
    phone: result.phone,
    message: result.message,
  }),
});
