import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./send-email', () => ({ sendEmail: vi.fn() }));

import { createFormLifecycle, clearTemplateCache } from './create-form-lifecycle';
import { sendEmail } from './send-email';

const UID = 'api::form-contact.form-contact';
const update = vi.fn();
const logError = vi.fn();

const lifecycle = createFormLifecycle({
  uid: UID,
  submitter: { template: 'contact.html', subject: 'Contacto recibido' },
  admin: { template: 'contact_copy.html', subject: 'Contacto Copía' },
  buildVars: (result) => ({ name: result.name, message: result.message }),
});

const event = { result: { id: 7, email: 'ada@example.com', name: 'Ada', message: 'secret note' } };

beforeEach(() => {
  vi.clearAllMocks();
  clearTemplateCache();
  vi.stubEnv('SMTP_EMAIL_ADMIN', 'admin@suyai.test');
  vi.stubEnv('SMTP_FROM', 'noreply@suyai.test');
  (globalThis as any).strapi = {
    dirs: { app: { root: process.cwd() } },
    log: { error: logError },
    db: { query: () => ({ update }) },
  };
});

describe('createFormLifecycle afterCreate', () => {
  it('sends both emails and marks emailSent when delivery succeeds', async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined);
    await lifecycle.afterCreate(event);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { emailSent: true } });
    expect(logError).not.toHaveBeenCalled();
  });

  it('never echoes the free-text message to the submitter', async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined);
    await lifecycle.afterCreate(event);

    const [submitterCall, adminCall] = vi.mocked(sendEmail).mock.calls.map(([options]) => options);
    expect(submitterCall.to).toBe('ada@example.com');
    expect(submitterCall.html).not.toContain('secret note');
    expect(adminCall.to).toBe('admin@suyai.test');
    expect(adminCall.html).toContain('secret note');
  });

  it('logs the failure and leaves emailSent false when a send fails', async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Resend 403'));
    await lifecycle.afterCreate(event);

    expect(update).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toContain('admin email failed: Resend 403');
    expect(logError.mock.calls[0][0]).toContain('id=7');
  });

  it('still delivers the admin notification when the submitter email fails', async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('bad address')).mockResolvedValueOnce(undefined);
    await lifecycle.afterCreate(event);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not throw when the pipeline itself fails (submission is already stored)', async () => {
    (globalThis as any).strapi.dirs.app.root = 'Z:/does-not-exist';
    await expect(lifecycle.afterCreate(event)).resolves.toBeUndefined();
    expect(logError.mock.calls[0][0]).toContain('pipeline failed');
  });
});
