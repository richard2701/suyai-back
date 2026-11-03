import { createFormResolver } from '../../../utils/create-form-resolver';

export default createFormResolver({
  uid: 'api::form-contact.form-contact',
  mutation: 'createFormContact',
  inputType: 'FormContactInput',
  fields: ['name', 'lastname', 'email', 'phone', 'message'],
  required: ['name', 'lastname', 'email', 'phone'],
  recaptchaAction: 'contact_form',
});
