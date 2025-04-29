import fs from 'fs';
import path from 'path';
import { env } from 'process';
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

        // Replace placeholders with actual data
        emailTemplate = emailTemplate
          .replace('{{ name }}', result.name)
          .replace('{{ lastname }}', result.lastname)
          .replace('{{ email }}', result.email)
          .replace('{{ phone }}', result.phone)
          .replace('{{ message }}', result.message)
          .replace('{{ copyYear }}', new Date().getFullYear().toString())

        // Replace placeholders with actual data
        emailTemplateCopy = emailTemplateCopy
          .replace('{{ name }}', result.name)
          .replace('{{ lastname }}', result.lastname)
          .replace('{{ email }}', result.email)
          .replace('{{ phone }}', result.phone)
          .replace('{{ message }}', result.message)
          .replace('{{ copyYear }}', new Date().getFullYear().toString())

        // Send the email
        await strapi.plugins['email'].services.email.send({
          to: result.email,
          from: env.SMTP_EMAIL_ADMIN,
          subject: 'Cotacto recibido',
          html: emailTemplate,
        });

        // Send copy email
        await strapi.plugins['email'].services.email.send({
          to: env.SMTP_EMAIL_ADMIN,
          from: env.SMTP_EMAIL_ADMIN,
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
