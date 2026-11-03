import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the reCAPTCHA service so the resolver's token gate always passes;
// these tests target the required-field validation, not reCAPTCHA.
vi.mock('../../../utils/recaptcha', () => ({
  validateRecaptcha: vi.fn().mockResolvedValue(true),
}));

import registerGraphql from './form-reservation-transfer';
import { validateRecaptcha } from '../../../utils/recaptcha';

type ResolverFn = (parent: unknown, args: unknown, context: unknown) => Promise<unknown>;

const SERVICE_UID = 'api::form-reservation-transfer.form-reservation-transfer';

/**
 * Runs the plugin's `register` with a fake Strapi, captures the extension
 * config it produces, and returns the createFormReservationTransfer resolver
 * together with the `create` spy so tests can assert persistence.
 */
function buildResolver() {
  const create = vi.fn().mockResolvedValue({ id: 1, documentId: 'doc-1', emailSent: false });
  const findOne = vi.fn().mockResolvedValue({ id: 1, documentId: 'doc-1', emailSent: true });
  let resolver: ResolverFn = async () => undefined;

  const strapi = {
    plugin: () => ({
      service: () => ({
        use: (factory: (deps: { nexus: unknown }) => { resolvers: Record<string, Record<string, { resolve: ResolverFn }>> }) => {
          const config = factory({ nexus: {} });
          resolver = config.resolvers.Mutation.createFormReservationTransfer.resolve;
        },
      }),
    }),
    services: {
      [SERVICE_UID]: { create },
    },
    documents: () => ({ findOne }),
  };

  registerGraphql.register({ strapi });
  return { resolver, create, findOne };
}

const validData = {
  recaptchaToken: 'token',
  name: 'Ada',
  lastname: 'Lovelace',
  email: 'ada@example.com',
  phone: '+56 9 1234 5678',
  transferDate: '2026-08-01',
  people: 2,
  destination: 'Airport SCL',
  pickupTime: '08:30:00.000',
};

describe('createFormReservationTransfer resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists the reservation when all required fields are present', async () => {
    const { resolver, create } = buildResolver();
    await resolver(null, { data: { ...validData } }, {});

    expect(create).toHaveBeenCalledTimes(1);
    const passed = create.mock.calls[0][0].data;
    expect(passed.destination).toBe('Airport SCL');
    expect(passed.pickupTime).toBe('08:30:00.000');
    // recaptchaToken must be stripped before persisting.
    expect(passed.recaptchaToken).toBeUndefined();
  });

  it('returns the re-fetched entity so emailSent reflects the real delivery status', async () => {
    const { resolver, findOne } = buildResolver();
    const response = await resolver(null, { data: { ...validData } }, {});

    expect(findOne).toHaveBeenCalledWith({ documentId: 'doc-1' });
    expect(response).toMatchObject({ emailSent: true });
  });

  it('throws GraphQLErrors with extension codes so the frontend can read the reason', async () => {
    const { resolver } = buildResolver();
    const { destination, ...data } = validData;

    await expect(resolver(null, { data }, {})).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });
    vi.mocked(validateRecaptcha).mockResolvedValueOnce(false);
    await expect(resolver(null, { data: { ...validData } }, {})).rejects.toMatchObject({
      extensions: { code: 'RECAPTCHA_FAILED' },
    });
  });

  it('drops fields outside the allowlist (mass assignment guard)', async () => {
    const { resolver, create } = buildResolver();
    await resolver(null, { data: { ...validData, emailSent: true, publishedAt: null } }, {});

    const passed = create.mock.calls[0][0].data;
    expect(passed.emailSent).toBeUndefined();
    expect('publishedAt' in passed).toBe(false);
    expect(passed.name).toBe('Ada');
  });

  it('rejects when destination is missing', async () => {
    const { resolver, create } = buildResolver();
    const { destination, ...data } = validData;

    await expect(resolver(null, { data }, {})).rejects.toThrow(
      'El campo destination es requerido.'
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects when pickupTime is missing', async () => {
    const { resolver, create } = buildResolver();
    const { pickupTime, ...data } = validData;

    await expect(resolver(null, { data }, {})).rejects.toThrow(
      'El campo pickupTime es requerido.'
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects URLs in echoed fields before calling reCAPTCHA', async () => {
    const { resolver, create } = buildResolver();

    await expect(
      resolver(null, { data: { ...validData, name: 'Win a prize at evil.com' } }, {})
    ).rejects.toThrow('Invalid form input.');
    expect(validateRecaptcha).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects malformed phone numbers', async () => {
    const { resolver, create } = buildResolver();

    await expect(
      resolver(null, { data: { ...validData, phone: 'call me http://x' } }, {})
    ).rejects.toThrow('Invalid form input.');
    expect(create).not.toHaveBeenCalled();
  });

  it('trims values before persisting', async () => {
    const { resolver, create } = buildResolver();
    await resolver(null, { data: { ...validData, name: '  Ada  ' } }, {});

    expect(create.mock.calls[0][0].data.name).toBe('Ada');
  });
});
