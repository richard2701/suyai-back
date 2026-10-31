import { GraphQLError } from 'graphql';
import { createLimiter, formRateLimitOptionsFromEnv, type RateLimiter } from './rate-limit-store';

/** Subset of the plugin-graphql resolver context used here ({ state, koaContext } in 5.59). */
export interface FormResolverContext {
  koaContext?: { ip?: string };
}

type Resolve = (parent: unknown, args: unknown, context: FormResolverContext, info: unknown) => unknown;

/**
 * plugin-graphql resolver middleware signature (wrap-resolvers.js):
 * middleware(next, parent, args, context, info).
 */
export type ResolverMiddleware = (
  next: Resolve,
  parent: unknown,
  args: unknown,
  context: FormResolverContext,
  info: unknown
) => unknown;

let sharedLimiter: RateLimiter | null = null;

// One bucket per client IP shared by all public form mutations, created lazily so the prune
// timer only exists in a running server.
const getSharedLimiter = (): RateLimiter => {
  if (sharedLimiter) return sharedLimiter;
  const options = formRateLimitOptionsFromEnv();
  const limiter = createLimiter(options);
  const timer = setInterval(limiter.prune, Math.min(options.windowMs, 60 * 1000));
  timer.unref();
  sharedLimiter = limiter;
  return limiter;
};

export const createFormRateLimitMiddleware =
  (getLimiter: () => RateLimiter = getSharedLimiter): ResolverMiddleware =>
  (next, parent, args, context, info) => {
    // Runs once per executed field, so aliased mutations in a single request each count.
    // ctx.ip derives from the trusted proxy header configured in src/index.ts.
    const key = context?.koaContext?.ip || 'unknown';
    const retryAfter = getLimiter().hit(key);
    if (retryAfter > 0) {
      throw new GraphQLError('Too many requests. Please try again later.', {
        extensions: { code: 'RATE_LIMITED', retryAfter },
      });
    }
    return next(parent, args, context, info);
  };

/**
 * Registered in each form mutation's resolversConfig. Middlewares run after auth and before
 * the resolver, so blocked requests never reach the (billed) reCAPTCHA assessment.
 */
export const formRateLimitMiddleware: ResolverMiddleware = createFormRateLimitMiddleware();
