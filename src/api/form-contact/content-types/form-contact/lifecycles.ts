import fs from 'fs';
import path from 'path';
export default {
  async afterCreate(event) {
    const { result } = event;

    // Prevent duplicate execution using a flag
    if (!result.emailSent) {
      try {
        // Load the email template
        const templatePath = path.resolve(__dirname, '../../../../../../config/email/templates/contact.html');
        let emailTemplate = fs.readFileSync(templatePath, 'utf-8');
        // Replace placeholders with actual data
        emailTemplate = emailTemplate
          .replace('{{ name }}', result.name)
          .replace('{{ lastname }}', result.lastname)
          .replace('{{ email }}', result.email)
          .replace('{{ phone }}', result.phone)
          .replace('{{ message }}', result.message)
          .replace('{{ copyYear }}', new Date().getFullYear().toString())

        // Send the email
        await strapi.plugins['email'].services.email.send({
          to: result.email,
          from: 'noreply@mainstylis.com',
          subject: 'Cotacto recibido',
          html: emailTemplate,
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
