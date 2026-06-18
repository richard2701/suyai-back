import fs from 'fs';
import path from 'path';
import { env } from 'process';
import { renderTemplate } from '../../../../utils/render-template';
import { sendEmail } from '../../../../utils/send-email';
export default {
  async afterCreate(event) {
    const { result } = event;

    // Prevent duplicate execution using a flag
    if (!result.emailSent) {
      try {
        // Load the email template
        const templatePath = path.resolve(__dirname, '../../../../../../config/email/templates/contact.html');
        const templatePathCopy = path.resolve(__dirname, '../../../../../../config/email/templates/contact_copy.html');
        let emailTemplate = fs.readFileSync(templatePath, 'utf-8');
        let emailTemplateCopy = fs.readFileSync(templatePathCopy, 'utf-8');

        // Replace placeholders with HTML-escaped data
        const templateVars = {
          name: result.name,
          lastname: result.lastname,
          email: result.email,
          phone: result.phone,
          message: result.message,
          copyYear: new Date().getFullYear().toString(),
        };
        emailTemplate = renderTemplate(emailTemplate, templateVars);
        emailTemplateCopy = renderTemplate(emailTemplateCopy, templateVars);

        // Send the email
        await sendEmail({
          to: result.email,
          from: env.SMTP_FROM,
          replyTo: env.SMTP_EMAIL_ADMIN,
          subject: 'Contacto recibido',
          html: emailTemplate,
        });

        // Send copy email
        await sendEmail({
          to: env.SMTP_EMAIL_ADMIN,
          from: env.SMTP_FROM,
          replyTo: result.email,
          subject: 'Contacto Copía',
          html: emailTemplateCopy,
        });

        // Update the record to mark email as sent
        // Mark email as sent
        // Use `strapi.db.query` instead of `entityService.update`
        await strapi.db.query("api::form-contact.form-contact").update({
          where: { id: result.id },
          data: { emailSent: true },
        });
      } catch (err) {
        console.error("Error sending email:", err);
      }
    }
  }
};
