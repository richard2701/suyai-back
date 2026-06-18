import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
}

/**
 * Send a transactional email through the Resend HTTP API (port 443).
 *
 * Render blocks outbound SMTP ports (25/465/587), so SMTP transports time out
 * with ETIMEDOUT. The HTTP API is the only reliable transport on Render.
 *
 * Throws on API error so callers keep their existing try/catch logging.
 */
export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const { to, from = process.env.SMTP_FROM, replyTo, subject, html } = options;

  if (!from) {
    throw new Error('Missing sender address: set SMTP_FROM or pass `from`.');
  }

  const { error } = await resend.emails.send({
    from,
    to,
    replyTo,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);
  }
};
