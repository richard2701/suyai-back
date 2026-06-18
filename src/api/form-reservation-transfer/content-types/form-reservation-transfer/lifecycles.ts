import fs from 'fs';
import path from 'path';
import { env } from 'process';
import { renderTemplate } from '../../../../utils/render-template';
export default {
  async afterCreate(event) {
    const { result } = event;

    // Prevent duplicate execution using a flag
    if (!result.emailSent) {
      try {
        // Load the email template
        const templatePath = path.resolve(__dirname, '../../../../../../config/email/templates/reservation_transfer.html');
        const templatePathCopy = path.resolve(__dirname, '../../../../../../config/email/templates/reservation_transfer_copy.html');
        let emailTemplate = fs.readFileSync(templatePath, 'utf-8');
        let emailTemplateCopy = fs.readFileSync(templatePathCopy, 'utf-8');

        // Replace placeholders with HTML-escaped data
        const templateVars = {
          name: result.name,
          lastname: result.lastname,
          email: result.email,
          phone: result.phone,
          message: result.message,
          transferDate: result.transferDate,
          people: result.people,
          copyYear: new Date().getFullYear().toString(),
        };
        emailTemplate = renderTemplate(emailTemplate, templateVars);
        emailTemplateCopy = renderTemplate(emailTemplateCopy, templateVars);


        // Send the email
        await strapi.plugins['email'].services.email.send({
          to: result.email,
          from: env.SMTP_FROM,
          replyTo: env.SMTP_EMAIL_ADMIN,
          subject: 'Reservacion Transfer',
          html: emailTemplate,
        });

        // Send copy email
        await strapi.plugins['email'].services.email.send({
          to: env.SMTP_EMAIL_ADMIN,
          from: env.SMTP_FROM,
          replyTo: result.email,
          subject: 'Reservacion Transfer Copía',
          html: emailTemplateCopy,
        });


        // Update the record to mark email as sent
        // Mark email as sent
        // Use `strapi.db.query` instead of `entityService.update`
        await strapi.db.query("api::form-reservation-transfer.form-reservation-transfer").update({
          where: { id: result.id },
          data: { emailSent: true },
        });
      } catch (err) {
        console.error("Error sending email:", err);
      }
    }
  }
};
