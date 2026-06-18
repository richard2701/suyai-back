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
        const templatePath = path.resolve(__dirname, '../../../../../../config/email/templates/reservation.html');
        let emailTemplate = fs.readFileSync(templatePath, 'utf-8');
        let tourNameChange
        if (!result.tourName) {
          const populatedResult = await strapi.db.query("api::form-reservation-tour.form-reservation-tour").findOne({
            where: { id: result.id },
            populate: { article: true } // Populate the 'article' relation
          });
          tourNameChange = populatedResult.article.title
        } else {
          tourNameChange = result.tourName
        }
        // Replace placeholders with HTML-escaped data
        emailTemplate = renderTemplate(emailTemplate, {
          name: result.name,
          lastname: result.lastname,
          tourName: tourNameChange,
          email: result.email,
          phone: result.phone,
          message: result.message,
          tourDate: result.tourDate,
          people: result.people,
          copyYear: new Date().getFullYear().toString(),
        });

        // Send the email
        await strapi.plugins['email'].services.email.send({
          to: result.email,
          from: env.SMTP_FROM,
          replyTo: env.SMTP_EMAIL_ADMIN,
          subject: 'Reservación de Tour recibida',
          html: emailTemplate,
        });

        // Update the record to mark email as sent
        // Mark email as sent
        // Use `strapi.db.query` instead of `entityService.update`
        await strapi.db.query("api::form-reservation-tour.form-reservation-tour").update({
          where: { id: result.id },
          data: { emailSent: true },
        });
      } catch (err) {
        console.error("Error sending email:", err);
      }
    }
  }
};
