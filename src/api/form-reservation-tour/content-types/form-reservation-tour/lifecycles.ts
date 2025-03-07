import fs from 'fs';
import path from 'path';
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
        // Replace placeholders with actual data
        emailTemplate = emailTemplate
          .replace('{{ name }}', result.name)
          .replace('{{ lastname }}', result.lastname)
          .replace('{{ tourName }}', tourNameChange)
          .replace('{{ email }}', result.email)
          .replace('{{ phone }}', result.phone)
          .replace('{{ message }}', result.message)
          .replace('{{ tourDate }}', result.tourDate)
          .replace('{{ people }}', result.people)
          .replace('{{ article }}', result.article)
          .replace('{{ copyYear }}', new Date().getFullYear().toString())

        // Send the email
        await strapi.plugins['email'].services.email.send({
          to: result.email,
          from: 'noreply@mainstylis.com',
          subject: 'The Strapi Email plugin worked successfully',
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
