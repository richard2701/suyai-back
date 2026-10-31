import { describe, it, expect } from 'vitest';
import {
  createForcePublishedDocumentMiddleware,
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

  it('leaves admin, API-token, background and write calls untouched', async () => {
    expect((await run(adminState, 'findMany')).status).toBe('draft');
    expect((await run(apiTokenState, 'findMany')).status).toBe('draft');
    expect((await run(undefined, 'findMany')).status).toBe('draft');
    expect((await run(publicState, 'update')).status).toBe('draft');
    expect((await run(publicState, 'findMany', { options: { draftAndPublish: false } })).status).toBe('draft');
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

  it('keeps drafts for API-token requests', async () => {
    const { args, stored } = await runField(apiTokenState, { status: 'draft' });
    expect(args.status).toBe('draft');
    expect(stored.status).toBe('draft');
  });
});
