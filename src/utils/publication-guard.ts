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
// Strapi 5.5x+ publication cohort args. With status forced to published they cannot return
// drafts, but modes such as `modified` would still let public callers probe whether unpublished
// draft edits exist, so they are dropped for public reads.
const PUBLICATION_COHORT_ARGS = ['publicationFilter', 'hasPublishedVersion'] as const;

const stripPublicationCohortArgs = (target: Record<string, unknown>): void => {
  for (const key of PUBLICATION_COHORT_ARGS) delete target[key];
};
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

/**
 * Document service middleware (strapi.documents.use) covering REST and GraphQL root reads.
 *
 * Applies to every content type, not only draft-and-publish ones: core propagates the root
 * `status` into populate sub-queries, so `GET /api/categories?status=draft&populate=articles`
 * would otherwise return draft articles through a non-D&P root. For non-D&P roots the status
 * is ignored by their own lookup (core draft-and-publish.js statusToLookup), so their rows are
 * unaffected.
 */
export const createForcePublishedDocumentMiddleware =
  (requestContext: RequestContextService) =>
  async (context: DocumentMiddlewareContext, next: () => Promise<unknown>): Promise<unknown> => {
    if (READ_ACTIONS.has(context.action) && mustForcePublished(requestContext.get()?.state)) {
      const params: Record<string, unknown> = { ...(context.params ?? {}), status: PUBLISHED };
      stripPublicationCohortArgs(params);
      context.params = params;
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
 * updates the copy plugin-graphql stored for nested association resolvers (5.60 association.ts
 * inherits both `status` and `publicationFilter` from it).
 */
export const forcePublishedApolloPlugin = {
  async requestDidStart() {
    return {
      async executionDidStart() {
        return {
          willResolveField({ source, args, contextValue, info }: ApolloFieldEvent): void {
            if (source || info.operation.operation !== 'query') return;
            if (!mustForcePublished(contextValue?.state)) return;
            if (args) {
              if ('status' in args) args.status = PUBLISHED;
              stripPublicationCohortArgs(args);
            }
            const stored = contextValue.rootQueryArgsByPath?.get(info.path.key);
            if (stored) {
              stored.status = PUBLISHED;
              stripPublicationCohortArgs(stored);
            }
          },
        };
      },
    };
  },
};

interface ContentTypeLike {
  options?: { draftAndPublish?: boolean };
}

/**
 * UIDs of the project's own (`api::`) draft-and-publish content types. Their `publishedAt`
 * GraphQL filter is disabled in src/index.ts: plugin-graphql's association resolver builds the
 * nested query with lodash merge(defaultFilters, publicationFilterWhere, clientFilters), so a
 * client filter such as `publishedAt: { notNull: false }` overrides the published-only default
 * and returns drafts through relations of non-D&P types (category, author).
 */
export const draftAndPublishApiUids = (contentTypes: Record<string, ContentTypeLike>): string[] =>
  Object.entries(contentTypes)
    .filter(([uid, contentType]) => uid.startsWith('api::') && contentType?.options?.draftAndPublish === true)
    .map(([uid]) => uid);
