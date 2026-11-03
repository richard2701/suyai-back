import { promises as fs } from 'fs';
import path from 'path';
import { renderTemplate } from './render-template';
import { sendEmail } from './send-email';

type TemplateVars = Record<string, unknown>;

interface FormEmail {
  /** Template file name under `config/email/templates/`. */
  template: string;
  subject: string;
}

export interface FormLifecycleConfig {
  uid: string;
  /** Confirmation sent to the submitter. Never echoes the free-text `message`. */
  submitter: FormEmail;
  /** Notification sent to the admin. Keeps the full message. */
  admin: FormEmail;
  /** Maps the created entity to template placeholders (may fetch relations). */
  buildVars: (result: Record<string, any>) => TemplateVars | Promise<TemplateVars>;
}

// Templates are static files: read each one once instead of blocking on every submission.
const templateCache = new Map<string, Promise<string>>();

const loadTemplate = (name: string): Promise<string> => {
  let cached = templateCache.get(name);
  if (!cached) {
    const file = path.join(strapi.dirs.app.root, 'config', 'email', 'templates', name);
    cached = fs.readFile(file, 'utf-8');
    // Do not cache failures, so a transient read error can recover on the next submission.
    cached.catch(() => templateCache.delete(name));
    templateCache.set(name, cached);
  }
  return cached;
};

/** Test hook: clears the in-memory template cache. */
export const clearTemplateCache = (): void => templateCache.clear();

/**
 * Builds the `afterCreate` lifecycle that emails the submitter and the admin and records the
 * outcome in `emailSent`. The submission is already persisted, so a delivery failure never
 * rejects the request; it is logged with the record id and leaves `emailSent: false`, which the
 * mutation response exposes to the frontend.
 */
export const createFormLifecycle = (config: FormLifecycleConfig) => ({
  async afterCreate(event: { result: Record<string, any> }) {
    const { result } = event;
    const adminAddress = process.env.SMTP_EMAIL_ADMIN;

    try {
      const vars = {
        ...(await config.buildVars(result)),
        copyYear: new Date().getFullYear().toString(),
      };
      const [submitterHtml, adminHtml] = await Promise.all([
        loadTemplate(config.submitter.template),
        loadTemplate(config.admin.template),
      ]);

      // The submitter copy goes to an attacker-controllable address, so it must not echo
      // free-text input (prevents using the form as a spam/phishing relay).
      const deliveries = await Promise.allSettled([
        sendEmail({
          to: result.email,
          from: process.env.SMTP_FROM,
          replyTo: adminAddress,
          subject: config.submitter.subject,
          html: renderTemplate(submitterHtml, { ...vars, message: '' }),
        }),
        sendEmail({
          to: adminAddress,
          from: process.env.SMTP_FROM,
          replyTo: result.email,
          subject: config.admin.subject,
          html: renderTemplate(adminHtml, vars),
        }),
      ]);

      const labels = ['submitter', 'admin'];
      deliveries.forEach((delivery, index) => {
        if (delivery.status === 'rejected') {
          strapi.log.error(
            `[form-email] ${config.uid} id=${result.id} ${labels[index]} email failed: ${delivery.reason?.message ?? delivery.reason}`
          );
        }
      });

      if (deliveries.every((delivery) => delivery.status === 'fulfilled')) {
        await strapi.db.query(config.uid).update({
          where: { id: result.id },
          data: { emailSent: true },
        });
      }
    } catch (err) {
      strapi.log.error(
        `[form-email] ${config.uid} id=${result.id} pipeline failed: ${(err as Error)?.message ?? err}`
      );
    }
  },
});
