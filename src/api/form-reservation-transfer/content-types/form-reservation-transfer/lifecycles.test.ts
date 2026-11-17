import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../utils/send-email', () => ({ sendEmail: vi.fn() }));

import lifecycle from './lifecycles';
import { sendEmail } from '../../../../utils/send-email';
import { clearTemplateCache } from '../../../../utils/create-form-lifecycle';

const update = vi.fn();

const baseResult = {
  id: 11,
  name: 'Ada',
  lastname: 'Lovelace',
  email: 'ada@example.com',
  phone: '+56 9 1234 5678',
  message: 'Two big suitcases',
  transferDate: '2026-12-01',
  people: 2,
  pickupTime: '08:30:00.000',
};

const sentHtml = (): { submitter: string; admin: string } => {
  const [submitter, admin] = vi.mocked(sendEmail).mock.calls.map(([options]) => options.html);
  return { submitter, admin };
};

beforeEach(() => {
  vi.clearAllMocks();
  clearTemplateCache();
  vi.stubEnv('SMTP_EMAIL_ADMIN', 'admin@suyai.test');
  vi.stubEnv('SMTP_FROM', 'noreply@suyai.test');
  vi.mocked(sendEmail).mockResolvedValue(undefined);
  (globalThis as unknown as { strapi: unknown }).strapi = {
    dirs: { app: { root: process.cwd() } },
    log: { error: vi.fn() },
    db: { query: () => ({ update }) },
  };
});

describe('form-reservation-transfer lifecycle', () => {
  it('shows direction and address in both notification emails', async () => {
    await lifecycle.afterCreate({
      result: {
        ...baseResult,
        direction: 'to_airport',
        address: 'Av. Providencia 123, Santiago',
        destination: 'Av. Providencia 123, Santiago',
      },
    });

    const { submitter, admin } = sentHtml();
    for (const html of [submitter, admin]) {
      expect(html).toContain('Hacia el aeropuerto');
      expect(html).toContain('Av. Providencia 123, Santiago');
      expect(html).not.toContain('{{ direction }}');
      expect(html).not.toContain('{{ address }}');
    }
    expect(update).toHaveBeenCalledWith({ where: { id: 11 }, data: { emailSent: true } });
  });

  it('renders legacy destination-only records with the default direction', async () => {
    await lifecycle.afterCreate({ result: { ...baseResult, destination: 'Valle Nevado' } });

    const { admin } = sentHtml();
    expect(admin).toContain('Desde el aeropuerto');
    expect(admin).toContain('Valle Nevado');
  });

  it('escapes the address in the email', async () => {
    await lifecycle.afterCreate({
      result: { ...baseResult, direction: 'from_airport', address: 'Calle "A" & B' },
    });

    expect(sentHtml().admin).toContain('Calle &quot;A&quot; &amp; B');
  });

  it('fills destination from address before create', () => {
    const event = { params: { data: { address: 'Las Condes' } as Record<string, unknown> } };
    lifecycle.beforeCreate(event);
    expect(event.params.data.destination).toBe('Las Condes');
  });

  it('keeps an explicit destination before create', () => {
    const event = { params: { data: { address: 'Las Condes', destination: 'Hotel W' } as Record<string, unknown> } };
    lifecycle.beforeCreate(event);
    expect(event.params.data.destination).toBe('Hotel W');
  });
});
