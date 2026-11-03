import { describe, it, expect, vi } from 'vitest';
import {
  computeCutoff,
  purgeConfigFromEnv,
  purgeFormSubmissions,
  FORM_SUBMISSION_UIDS,
  type PurgeConfig,
  type PurgeStrapi,
} from './purge-form-submissions';

const NOW = new Date('2026-06-15T12:00:00.000Z');

interface Doc {
  documentId: string;
  createdAt: string;
}

/** In-memory Document Service mock honoring the createdAt $lt filter, limit and delete. */
const makeStrapi = (data: Record<string, Doc[]>, failOn: Record<string, 'count' | 'delete'> = {}) => {
  const store = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, [...v]]));
  const log = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const calls = { findMany: [] as Record<string, unknown>[], deleted: [] as string[] };
  const matching = (uid: string, params: Record<string, any>): Doc[] =>
    (store[uid] ?? [])
      .filter((d) => d.createdAt < params.filters.createdAt.$lt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const strapi: PurgeStrapi = {
    log,
    documents: (uid: string) => ({
      count: async (params) => {
        if (failOn[uid] === 'count') throw new Error('db down');
        return matching(uid, params).length;
      },
      findMany: async (params) => {
        calls.findMany.push(params);
        return matching(uid, params)
          .slice(0, params.limit as number)
          .map((d) => ({ documentId: d.documentId }));
      },
      delete: async ({ documentId }) => {
        if (failOn[uid] === 'delete') throw new Error('delete failed');
        calls.deleted.push(`${uid}:${documentId}`);
        store[uid] = store[uid].filter((d) => d.documentId !== documentId);
      },
    }),
  };
  return { strapi, log, calls, store };
};

const old = (id: string, days = 400): Doc => ({
  documentId: id,
  createdAt: new Date(NOW.getTime() - days * 86_400_000).toISOString(),
});
const recent = (id: string): Doc => old(id, 10);

const live: PurgeConfig = { retentionDays: 365, dryRun: false, batchSize: 2, maxPerRun: 100 };
const [A, B, C] = FORM_SUBMISSION_UIDS;

describe('computeCutoff', () => {
  it('subtracts whole days from the injected clock', () => {
    expect(computeCutoff(NOW, 365).toISOString()).toBe('2025-06-15T12:00:00.000Z');
    expect(computeCutoff(NOW, 1).toISOString()).toBe('2026-06-14T12:00:00.000Z');
  });
});

describe('purgeConfigFromEnv', () => {
  it('defaults to 365 days and dry run ON', () => {
    expect(purgeConfigFromEnv({})).toMatchObject({ retentionDays: 365, dryRun: true });
  });
  it('only disables dry run with the literal "false"', () => {
    expect(purgeConfigFromEnv({ FORM_RETENTION_DRY_RUN: 'false' }).dryRun).toBe(false);
    expect(purgeConfigFromEnv({ FORM_RETENTION_DRY_RUN: ' FALSE ' }).dryRun).toBe(false);
    for (const v of ['true', '0', 'no', '', 'flase']) {
      expect(purgeConfigFromEnv({ FORM_RETENTION_DRY_RUN: v }).dryRun).toBe(true);
    }
  });
  it('falls back to the default for invalid retention days', () => {
    for (const v of ['abc', '0', '-5', '1.5', '']) {
      expect(purgeConfigFromEnv({ FORM_RETENTION_DAYS: v }).retentionDays).toBe(365);
    }
    expect(purgeConfigFromEnv({ FORM_RETENTION_DAYS: '730' }).retentionDays).toBe(730);
  });
});

describe('purgeFormSubmissions', () => {
  it('dry run counts and logs but never deletes or lists records', async () => {
    const { strapi, log, calls } = makeStrapi({ [A]: [old('a1'), old('a2'), recent('a3')], [B]: [], [C]: [old('c1')] });
    const res = await purgeFormSubmissions(strapi, { ...live, dryRun: true }, NOW);
    expect(res.dryRun).toBe(true);
    expect(res.results.map((r) => [r.eligible, r.deleted])).toEqual([[2, 0], [0, 0], [1, 0]]);
    expect(calls.deleted).toEqual([]);
    expect(calls.findMany).toEqual([]);
    expect(log.info).toHaveBeenCalledTimes(3);
    expect(log.info.mock.calls[0][0]).toContain('DRY RUN');
    expect(log.info.mock.calls[0][0]).toContain('2 document(s) would be deleted');
  });

  it('deletes only documents older than the cutoff, across batches', async () => {
    const { strapi, calls, store } = makeStrapi({
      [A]: [old('a1'), old('a2'), old('a3'), recent('a4')],
      [B]: [recent('b1')],
      [C]: [],
    });
    const res = await purgeFormSubmissions(strapi, live, NOW);
    expect(res.results[0]).toMatchObject({ eligible: 3, deleted: 3 });
    expect(store[A].map((d) => d.documentId)).toEqual(['a4']);
    expect(store[B]).toHaveLength(1);
    expect(calls.deleted).toHaveLength(3);
    expect(res.cutoff).toBe('2025-06-15T12:00:00.000Z');
  });

  it('treats a record exactly at the cutoff as not expired', async () => {
    const edge: Doc = { documentId: 'edge', createdAt: '2025-06-15T12:00:00.000Z' };
    const { strapi, calls } = makeStrapi({ [A]: [edge], [B]: [], [C]: [] });
    await purgeFormSubmissions(strapi, live, NOW);
    expect(calls.deleted).toEqual([]);
  });

  it('queries draft status so each document is listed once', async () => {
    const { strapi, calls } = makeStrapi({ [A]: [old('a1')], [B]: [], [C]: [] });
    await purgeFormSubmissions(strapi, live, NOW);
    expect(calls.findMany[0]).toMatchObject({ status: 'draft', fields: ['documentId'], sort: 'createdAt:asc' });
  });

  it('respects the hard cap per run and per type', async () => {
    const many = Array.from({ length: 10 }, (_, i) => old(`a${i}`));
    const { strapi, calls, store } = makeStrapi({ [A]: many, [B]: [...many.map((d) => ({ ...d, documentId: `b${d.documentId}` }))], [C]: [] });
    const res = await purgeFormSubmissions(strapi, { ...live, batchSize: 2, maxPerRun: 5 }, NOW);
    expect(res.results[0]).toMatchObject({ eligible: 10, deleted: 5 });
    expect(res.results[1]).toMatchObject({ eligible: 10, deleted: 5 });
    expect(store[A]).toHaveLength(5);
    expect(calls.deleted).toHaveLength(10);
    // Last batch is trimmed so the cap is never exceeded (2 + 2 + 1).
    expect(calls.findMany.filter((p) => p.limit === 1)).toHaveLength(2);
  });

  it('an error on one type does not stop the others and logs no PII', async () => {
    const { strapi, log, calls } = makeStrapi(
      { [A]: [old('a1')], [B]: [old('b1')], [C]: [old('c1')] },
      { [A]: 'count' },
    );
    const res = await purgeFormSubmissions(strapi, live, NOW);
    expect(res.results[0].error).toBe('db down');
    expect(res.results[1]).toMatchObject({ deleted: 1 });
    expect(res.results[2]).toMatchObject({ deleted: 1 });
    expect(calls.deleted).toEqual([`${B}:b1`, `${C}:c1`]);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error.mock.calls[0][0]).toContain(A);
  });

  it('keeps the partial count when a delete fails mid-run', async () => {
    const { strapi, log } = makeStrapi({ [A]: [old('a1')], [B]: [], [C]: [] }, { [A]: 'delete' });
    const res = await purgeFormSubmissions(strapi, live, NOW);
    expect(res.results[0]).toMatchObject({ deleted: 0, error: 'delete failed' });
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it('never logs record identifiers or data', async () => {
    const { strapi, log } = makeStrapi({ [A]: [old('SECRET-ID')], [B]: [], [C]: [] });
    await purgeFormSubmissions(strapi, live, NOW);
    const all = [...log.info.mock.calls, ...log.error.mock.calls].flat().join('\n');
    expect(all).not.toContain('SECRET-ID');
  });
});
