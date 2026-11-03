import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from 'koa';
import { extractBearerToken, resolveAdminUser, type AdminAuthStrapi } from '../utils/admin-auth';

vi.mock('@strapi/strapi', () => ({
  factories: {
    createCoreController: (_uid: string, config: unknown) => config,
  },
}));

type ValidateResult =
  | { isValid: true; payload: { userId: string; sessionId: string; type: 'access'; exp: number; iat: number } }
  | { isValid: false; payload: null };

interface MockState {
  validate: ValidateResult | Error;
  sessionActive: boolean;
  user: Record<string, unknown> | null;
}

const validPayload = { userId: '7', sessionId: 'sess-1', type: 'access' as const, exp: 0, iat: 0 };

const createStrapi = (state: MockState) => {
  const findOne = vi.fn(async () => state.user);
  const isSessionActive = vi.fn(async () => state.sessionActive);
  const validateAccessToken = vi.fn(() => {
    if (state.validate instanceof Error) throw state.validate;
    return state.validate;
  });
  const manager = vi.fn(() => ({ validateAccessToken, isSessionActive }));
  const generateToken = vi.fn(async () => ({ id: 1, documentId: 'd1', token: 't', expiresAt: 'x', label: 'l' }));
  const findMany = vi.fn(async () => [{ id: 1, documentId: 'd1', label: 'l', expiresAt: 'x', active: true, createdAt: 'c' }]);

  const strapi = {
    sessionManager: manager,
    db: { query: vi.fn(() => ({ findOne })) },
    service: vi.fn(() => ({ generateToken })),
    documents: vi.fn(() => ({ findMany })),
  };

  return { strapi, findOne, isSessionActive, validateAccessToken, manager, generateToken, findMany };
};

const asAuthStrapi = (strapi: object) => strapi as unknown as AdminAuthStrapi;

describe('extractBearerToken', () => {
  it('accepts a well-formed bearer header (case-insensitive scheme)', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('rejects missing, malformed or non-bearer headers', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
  });
});

describe('resolveAdminUser', () => {
  let state: MockState;

  beforeEach(() => {
    state = { validate: { isValid: true, payload: validPayload }, sessionActive: true, user: { id: 7, isActive: true } };
  });

  it('returns the active admin user for a valid token with an active session', async () => {
    const mocks = createStrapi(state);
    const user = await resolveAdminUser(asAuthStrapi(mocks.strapi), 'Bearer token');

    expect(user).toEqual({ id: 7, isActive: true });
    expect(mocks.manager).toHaveBeenCalledWith('admin');
    expect(mocks.validateAccessToken).toHaveBeenCalledWith('token');
    expect(mocks.isSessionActive).toHaveBeenCalledWith('sess-1');
    expect(mocks.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('keeps non-numeric user ids as strings', async () => {
    state.validate = { isValid: true, payload: { ...validPayload, userId: 'abc' } };
    const mocks = createStrapi(state);
    await resolveAdminUser(asAuthStrapi(mocks.strapi), 'Bearer token');
    expect(mocks.findOne).toHaveBeenCalledWith({ where: { id: 'abc' } });
  });

  it('fails closed when no token is sent', async () => {
    const mocks = createStrapi(state);
    expect(await resolveAdminUser(asAuthStrapi(mocks.strapi), undefined)).toBeNull();
    expect(mocks.validateAccessToken).not.toHaveBeenCalled();
  });

  it('fails closed for an invalid token (e.g. a users-permissions JWT)', async () => {
    state.validate = { isValid: false, payload: null };
    const mocks = createStrapi(state);
    expect(await resolveAdminUser(asAuthStrapi(mocks.strapi), 'Bearer public')).toBeNull();
    expect(mocks.isSessionActive).not.toHaveBeenCalled();
  });

  it('fails closed when the session was revoked or expired', async () => {
    state.sessionActive = false;
    const mocks = createStrapi(state);
    expect(await resolveAdminUser(asAuthStrapi(mocks.strapi), 'Bearer token')).toBeNull();
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it('fails closed when the admin user is missing or inactive', async () => {
    state.user = null;
    expect(await resolveAdminUser(asAuthStrapi(createStrapi(state).strapi), 'Bearer token')).toBeNull();

    state.user = { id: 7, isActive: false };
    expect(await resolveAdminUser(asAuthStrapi(createStrapi(state).strapi), 'Bearer token')).toBeNull();

    state.user = { id: 7 };
    expect(await resolveAdminUser(asAuthStrapi(createStrapi(state).strapi), 'Bearer token')).toBeNull();
  });

  it('fails closed when the session manager throws or is unavailable', async () => {
    state.validate = new Error('boom');
    expect(await resolveAdminUser(asAuthStrapi(createStrapi(state).strapi), 'Bearer token')).toBeNull();

    const mocks = createStrapi(state);
    const withoutManager = { ...mocks.strapi, sessionManager: undefined };
    expect(await resolveAdminUser(asAuthStrapi(withoutManager), 'Bearer token')).toBeNull();
  });
});

type Handler = (ctx: Context) => Promise<unknown>;
type ControllerFactory = (deps: { strapi: unknown }) => Record<'generate' | 'find' | 'update' | 'validate', Handler>;

const createCtx = (authorization?: string) => {
  const unauthorized = vi.fn((message: string) => ({ status: 401, message }));
  const forbidden = vi.fn((message: string) => ({ status: 403, message }));
  const ctx = {
    request: { header: authorization ? { authorization } : {}, body: { label: 'qa' } },
    query: {},
    params: { id: 'd1' },
    body: undefined as unknown,
    unauthorized,
    forbidden,
    badRequest: vi.fn(),
    notFound: vi.fn(),
    send: vi.fn(),
  };
  return ctx;
};

describe('feature-flag-token controller admin gating', () => {
  const loadController = async (state: MockState) => {
    const mocks = createStrapi(state);
    const { default: factory } = (await import('./feature-flag-token')) as unknown as { default: ControllerFactory };
    return { controller: factory({ strapi: mocks.strapi }), mocks };
  };

  const validState = (): MockState => ({
    validate: { isValid: true, payload: validPayload },
    sessionActive: true,
    user: { id: 7, isActive: true },
  });

  it('answers 401 (not 403) to generate/find/update without an admin token', async () => {
    const { controller, mocks } = await loadController(validState());
    for (const action of ['generate', 'find', 'update'] as const) {
      const ctx = createCtx();
      await controller[action](ctx as unknown as Context);
      expect(ctx.unauthorized).toHaveBeenCalledWith('Admin authentication required');
      expect(ctx.forbidden).not.toHaveBeenCalled();
    }
    expect(mocks.generateToken).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('answers 401 to an expired/invalid access token so the admin client refreshes and retries', async () => {
    const { controller, mocks } = await loadController({ ...validState(), validate: { isValid: false, payload: null } });
    const ctx = createCtx('Bearer expired-or-users-permissions-jwt');
    await controller.find(ctx as unknown as Context);
    expect(ctx.unauthorized).toHaveBeenCalled();
    expect(ctx.forbidden).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('answers 401 when the session is no longer active or the admin is inactive', async () => {
    for (const state of [{ ...validState(), sessionActive: false }, { ...validState(), user: { id: 7, isActive: false } }]) {
      const { controller, mocks } = await loadController(state);
      const ctx = createCtx('Bearer admin-access-token');
      await controller.update(ctx as unknown as Context);
      expect(ctx.unauthorized).toHaveBeenCalled();
      expect(mocks.generateToken).not.toHaveBeenCalled();
    }
  });

  it('allows an active admin with an active session', async () => {
    const { controller, mocks } = await loadController(validState());

    const genCtx = createCtx('Bearer admin-access-token');
    await controller.generate(genCtx as unknown as Context);
    expect(genCtx.unauthorized).not.toHaveBeenCalled();
    expect(mocks.generateToken).toHaveBeenCalledWith('qa');

    const findCtx = createCtx('Bearer admin-access-token');
    await controller.find(findCtx as unknown as Context);
    expect(findCtx.unauthorized).not.toHaveBeenCalled();
    expect(findCtx.body).toEqual({
      data: [{ id: 1, documentId: 'd1', label: 'l', expiresAt: 'x', active: true, createdAt: 'c' }],
    });
  });
});
