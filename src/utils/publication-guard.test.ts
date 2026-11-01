import { describe, it, expect } from 'vitest';
import {
  createForcePublishedDocumentMiddleware,
  draftAndPublishApiUids,
  forcePublishedApolloPlugin,
  mustForcePublished,
} from './publication-guard';

const publicState = { route: { info: { type: 'content-api' } }, auth: { strategy: { name: 'users-permissions' } } };
const apiTokenState = { route: { info: { type: 'content-api' } }, auth: { strategy: { name: 'api-token' } } };
const adminState = { route: { info: { type: 'admin' } }, auth: { strategy: { name: 'admin' } } };

describe('mustForcePublished', () => {
  it('applies to public / users-permissions / unauthenticated content-API requests only', () => {
    expect(mustForcePublished(publicState)).toBe(true);
    expect(mustForcePublished({ route: { info: { type: 'content-api' } } })).toBe(true);
    expect(mustForcePublished(apiTokenState)).toBe(false);
    expect(mustForcePublished(adminState)).toBe(false);
    expect(mustForcePublished(undefined)).toBe(false);
  });
});

describe('document service middleware', () => {
  const draftAndPublish = { options: { draftAndPublish: true } };
  const run = async (state: object | undefined, action: string, contentType = draftAndPublish) => {
    const middleware = createForcePublishedDocumentMiddleware({ get: () => (state ? { state } : undefined) });
    const context = { action, contentType, params: { status: 'draft', filters: { slug: 'x' } } };
    await middleware(context, async () => undefined);
    return context.params;
  };

  it('forces published status on public reads', async () => {
    expect(await run(publicState, 'findMany')).toEqual({ status: 'published', filters: { slug: 'x' } });
    expect((await run(publicState, 'findOne')).status).toBe('published');
    expect((await run(publicState, 'count')).status).toBe('published');
  });

  it('forces published status on public reads of non-D&P roots so populated D&P relations stay published', async () => {
    const nonDraftAndPublish = { options: { draftAndPublish: false } };
    const middleware = createForcePublishedDocumentMiddleware({ get: () => ({ state: publicState }) });
    const context = {
      action: 'findMany',
      contentType: nonDraftAndPublish,
      params: { status: 'draft', populate: { articles: true }, publicationFilter: 'modified' } as Record<string, unknown>,
    };
    await middleware(context, async () => undefined);
    expect(context.params).toEqual({ status: 'published', populate: { articles: true } });
    expect((await run(apiTokenState, 'findMany', nonDraftAndPublish)).status).toBe('draft');
  });

  it('drops publication cohort params on public reads only', async () => {
    const runWithCohort = async (state: object) => {
      const middleware = createForcePublishedDocumentMiddleware({ get: () => ({ state }) });
      const context = {
        action: 'findMany',
        contentType: draftAndPublish,
        params: { status: 'draft', publicationFilter: 'modified', hasPublishedVersion: 'true' } as Record<string, unknown>,
      };
      await middleware(context, async () => undefined);
      return context.params;
    };
    expect(await runWithCohort(publicState)).toEqual({ status: 'published' });
    expect((await runWithCohort(apiTokenState)).publicationFilter).toBe('modified');
  });

  it('leaves admin, API-token, background and write calls untouched', async () => {
    expect((await run(adminState, 'findMany')).status).toBe('draft');
    expect((await run(apiTokenState, 'findMany')).status).toBe('draft');
    expect((await run(undefined, 'findMany')).status).toBe('draft');
    expect((await run(publicState, 'update')).status).toBe('draft');
  });
});

describe('Apollo plugin', () => {
  const runField = async (state: object, args: Record<string, unknown>, operation = 'query') => {
    const stored = { ...args, _originField: 'articles' };
    const contextValue = { state, rootQueryArgsByPath: new Map<string | number, Record<string, unknown>>([['articles', stored]]) };
    const request = await forcePublishedApolloPlugin.requestDidStart();
    const execution = await request.executionDidStart();
    execution.willResolveField({
      source: undefined,
      args,
      contextValue,
      info: { path: { key: 'articles' }, operation: { operation } },
    });
    return { args, stored };
  };

  it('rewrites root status and the stored copy used by nested relations', async () => {
    const { args, stored } = await runField(publicState, { status: 'draft' });
    expect(args.status).toBe('published');
    expect(stored.status).toBe('published');
  });

  it('drops publicationFilter / hasPublishedVersion for public callers', async () => {
    const { args, stored } = await runField(publicState, { status: 'draft', publicationFilter: 'MODIFIED', hasPublishedVersion: true });
    expect(args).toEqual({ status: 'published' });
    expect(stored).toEqual({ status: 'published', _originField: 'articles' });
  });

  it('keeps drafts for API-token requests', async () => {
    const { args, stored } = await runField(apiTokenState, { status: 'draft' });
    expect(args.status).toBe('draft');
    expect(stored.status).toBe('draft');
  });
});

describe('draftAndPublishApiUids', () => {
  it('returns only api:: content types with draft-and-publish enabled', () => {
    expect(
      draftAndPublishApiUids({
        'api::article.article': { options: { draftAndPublish: true } },
        'api::category.category': { options: { draftAndPublish: false } },
        'api::author.author': {},
        'plugin::users-permissions.user': { options: { draftAndPublish: true } },
        'admin::user': { options: { draftAndPublish: true } },
      }),
    ).toEqual(['api::article.article']);
  });
});
