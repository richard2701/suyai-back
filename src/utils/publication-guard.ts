/**
 * Prevents public content-API callers from reading draft documents.
 *
 * Strapi 5 honours a client-supplied `status=draft` (REST) / `status: DRAFT` (GraphQL) for any
 * role that holds `find`/`findOne`, including Public, and the GraphQL association resolver
 * forwards the root query's status to nested relations. Only API-token requests (trusted
 * server-side callers, e.g. a future preview integration) may still request drafts.
 * Admin panel (content-manager) requests are untouched: their route type is 'admin'.
 */

interface AuthState {
  strategy?: { name?: string };
}

interface RequestState {
  auth?: AuthState;
  route?: { info?: { type?: string } };
}

const PUBLISHED = 'published';
const DRAFT_CAPABLE_STRATEGIES = new Set(['api-token']);
const READ_ACTIONS = new Set(['findMany', 'findFirst', 'findOne', 'count']);

export const mustForcePublished = (state: RequestState | undefined): boolean => {
  if (!state || state.route?.info?.type !== 'content-api') return false;
  const strategyName = state.auth?.strategy?.name;
  return !strategyName || !DRAFT_CAPABLE_STRATEGIES.has(strategyName);
};

interface DocumentMiddlewareContext {
  action: string;
  contentType?: { options?: { draftAndPublish?: boolean } };
  params?: Record<string, unknown>;
}

interface RequestContextService {
  get: () => { state?: RequestState } | undefined;
}

/** Document service middleware (strapi.documents.use) covering REST and GraphQL root reads. */
export const createForcePublishedDocumentMiddleware =
  (requestContext: RequestContextService) =>
  async (context: DocumentMiddlewareContext, next: () => Promise<unknown>): Promise<unknown> => {
    if (
      READ_ACTIONS.has(context.action) &&
      context.contentType?.options?.draftAndPublish === true &&
      mustForcePublished(requestContext.get()?.state)
    ) {
      context.params = { ...(context.params ?? {}), status: PUBLISHED };
    }
    return next();
  };

interface FieldResolveInfo {
  path: { key: string | number; prev?: unknown };
  operation: { operation: string };
}

interface ApolloFieldEvent {
  source: unknown;
  args: Record<string, unknown>;
  contextValue: {
    state?: RequestState;
    rootQueryArgsByPath?: Map<string | number, Record<string, unknown>>;
  };
  info: FieldResolveInfo;
}

/**
 * Apollo Server plugin, appended after plugin-graphql's own root-args plugin (config arrays are
 * concatenated). Rewrites the root query field's `status` arg before its resolver runs and
 * updates the copy plugin-graphql stored for nested association resolvers.
 */
export const forcePublishedApolloPlugin = {
  async requestDidStart() {
    return {
      async executionDidStart() {
        return {
          willResolveField({ source, args, contextValue, info }: ApolloFieldEvent): void {
            if (source || info.operation.operation !== 'query') return;
            if (!mustForcePublished(contextValue?.state)) return;
            if (args && 'status' in args) args.status = PUBLISHED;
            const stored = contextValue.rootQueryArgsByPath?.get(info.path.key);
            if (stored) stored.status = PUBLISHED;
          },
        };
      },
    };
  },
};
