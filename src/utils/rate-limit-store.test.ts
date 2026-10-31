import { describe, it, expect } from 'vitest';
import { GraphQLError } from 'graphql';
import { createLimiter, formRateLimitOptionsFromEnv } from './rate-limit-store';
import { createFormRateLimitMiddleware, type FormResolverContext } from './form-rate-limit';

const clock = (start = 0) => {
  let t = start;
  return { now: (): number => t, advance: (ms: number): void => { t += ms; } };
};

describe('createLimiter', () => {
  it('blocks after max hits and resets after the window', () => {
    const c = clock();
    const limiter = createLimiter({ max: 2, windowMs: 10_000, now: c.now });
    expect(limiter.hit('a')).toBe(0);
    expect(limiter.hit('a')).toBe(0);
    expect(limiter.hit('a')).toBe(10);
    expect(limiter.hit('b')).toBe(0);
    c.advance(10_000);
    expect(limiter.hit('a')).toBe(0);
  });

  it('caps tracked keys, evicting the oldest window first', () => {
    const c = clock();
    const limiter = createLimiter({ max: 1, windowMs: 60_000, maxKeys: 3, now: c.now });
    for (const key of ['k1', 'k2', 'k3']) {
      limiter.hit(key);
      c.advance(1);
    }
    limiter.hit('k4');
    expect(limiter.size()).toBe(3);
    // k1 was evicted (fresh window), k2 is still tracked (blocked).
    expect(limiter.hit('k1')).toBe(0);
    expect(limiter.size()).toBe(3);
    expect(limiter.hit('k4')).toBeGreaterThan(0);
  });

  it('prefers pruning expired buckets over evicting live ones', () => {
    const c = clock();
    const limiter = createLimiter({ max: 1, windowMs: 1_000, maxKeys: 2, now: c.now });
    limiter.hit('old');
    c.advance(900);
    limiter.hit('live');
    c.advance(200); // 'old' expired, 'live' still active
    limiter.hit('new');
    expect(limiter.hit('live')).toBeGreaterThan(0);
  });

  it('reads env overrides and ignores invalid values', () => {
    expect(formRateLimitOptionsFromEnv({})).toEqual({ max: 5, windowMs: 600_000 });
    expect(formRateLimitOptionsFromEnv({ FORM_RATE_LIMIT_MAX: '3', FORM_RATE_LIMIT_WINDOW_MINUTES: '1' })).toEqual({
      max: 3,
      windowMs: 60_000,
    });
    expect(formRateLimitOptionsFromEnv({ FORM_RATE_LIMIT_MAX: 'abc', FORM_RATE_LIMIT_WINDOW_MINUTES: '-2' })).toEqual({
      max: 5,
      windowMs: 600_000,
    });
  });
});

describe('form rate limit resolver middleware', () => {
  const ctx = (ip: string): FormResolverContext => ({ koaContext: { ip } });

  it('counts every field execution (aliases) and throws RATE_LIMITED', async () => {
    const limiter = createLimiter({ max: 2, windowMs: 60_000 });
    const middleware = createFormRateLimitMiddleware(() => limiter);
    const next = async (): Promise<string> => 'ok';

    await expect(middleware(next, null, {}, ctx('1.1.1.1'), {})).resolves.toBe('ok');
    await expect(middleware(next, null, {}, ctx('1.1.1.1'), {})).resolves.toBe('ok');

    let caught: unknown;
    try {
      await middleware(next, null, {}, ctx('1.1.1.1'), {});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GraphQLError);
    expect((caught as GraphQLError).extensions.code).toBe('RATE_LIMITED');

    await expect(middleware(next, null, {}, ctx('2.2.2.2'), {})).resolves.toBe('ok');
  });

  it('does not call the resolver when blocked', () => {
    const limiter = createLimiter({ max: 1, windowMs: 60_000 });
    const middleware = createFormRateLimitMiddleware(() => limiter);
    let calls = 0;
    const next = (): number => ++calls;
    middleware(next, null, {}, ctx('3.3.3.3'), {});
    expect(() => middleware(next, null, {}, ctx('3.3.3.3'), {})).toThrow(GraphQLError);
    expect(calls).toBe(1);
  });
});
