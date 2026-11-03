/** Content types holding visitor PII that are subject to the retention policy. */
export const FORM_SUBMISSION_UIDS = [
  'api::form-contact.form-contact',
  'api::form-reservation-tour.form-reservation-tour',
  'api::form-reservation-transfer.form-reservation-transfer',
] as const;

// NOTE: placeholder default. The owner must decide the real retention period (see docs/form-retention.md).
export const DEFAULT_RETENTION_DAYS = 365;
export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_MAX_PER_RUN = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeConfig {
  retentionDays: number;
  /** When true nothing is deleted; only counts are logged. */
  dryRun: boolean;
  batchSize: number;
  /** Hard cap of documents deleted per content type per run. */
  maxPerRun: number;
}

export interface PurgeLogger {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

/** Minimal slice of the Strapi instance used here, so tests can inject a mock. */
export interface PurgeStrapi {
  documents: (uid: string) => {
    count: (params: Record<string, unknown>) => Promise<number>;
    findMany: (params: Record<string, unknown>) => Promise<Array<{ documentId: string }>>;
    delete: (params: { documentId: string }) => Promise<unknown>;
  };
  log: PurgeLogger;
}

export interface PurgeTypeResult {
  uid: string;
  /** Documents older than the cutoff (a draft + published pair counts as one). */
  eligible: number;
  deleted: number;
  error?: string;
}

export interface PurgeResult {
  dryRun: boolean;
  cutoff: string;
  results: PurgeTypeResult[];
}

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Reads the policy from env. Dry run is ON unless the value is exactly "false" (case-insensitive),
 * so a typo or missing variable never enables deletion.
 */
export const purgeConfigFromEnv = (env: Record<string, string | undefined>): PurgeConfig => ({
  retentionDays: parsePositiveInt(env.FORM_RETENTION_DAYS, DEFAULT_RETENTION_DAYS),
  dryRun: (env.FORM_RETENTION_DRY_RUN ?? 'true').trim().toLowerCase() !== 'false',
  batchSize: DEFAULT_BATCH_SIZE,
  maxPerRun: DEFAULT_MAX_PER_RUN,
});

export const computeCutoff = (now: Date, retentionDays: number): Date =>
  new Date(now.getTime() - retentionDays * DAY_MS);

/**
 * Deletes (or, in dry run, counts) form submissions created before `now - retentionDays`.
 * Queries the draft status, which lists every document exactly once; deleting by documentId
 * removes both the draft and the published row.
 * Logs only counts and content-type uids, never submission data. An error on one type is
 * logged (message only) and does not stop the remaining types.
 */
export const purgeFormSubmissions = async (
  strapi: PurgeStrapi,
  config: PurgeConfig,
  now: Date = new Date(),
  uids: readonly string[] = FORM_SUBMISSION_UIDS,
): Promise<PurgeResult> => {
  const cutoff = computeCutoff(now, config.retentionDays);
  const filters = { createdAt: { $lt: cutoff.toISOString() } };
  const results: PurgeTypeResult[] = [];

  for (const uid of uids) {
    const result: PurgeTypeResult = { uid, eligible: 0, deleted: 0 };
    try {
      const docs = strapi.documents(uid);
      result.eligible = await docs.count({ filters, status: 'draft' });

      if (!config.dryRun) {
        while (result.deleted < config.maxPerRun) {
          const limit = Math.min(config.batchSize, config.maxPerRun - result.deleted);
          // Deleted documents drop out of the filter, so always re-read the first page.
          const batch = await docs.findMany({
            filters,
            status: 'draft',
            fields: ['documentId'],
            sort: 'createdAt:asc',
            limit,
          });
          if (batch.length === 0) break;
          for (const { documentId } of batch) {
            await docs.delete({ documentId });
            result.deleted += 1;
          }
        }
      }

      const message = config.dryRun
        ? `[form-retention] DRY RUN ${uid}: ${result.eligible} document(s) would be deleted`
        : `[form-retention] ${uid}: ${result.deleted} of ${result.eligible} document(s) deleted`;
      strapi.log.info(`${message} (created before ${cutoff.toISOString()})`);
    } catch (error) {
      // Message only: never log the records themselves.
      result.error = error instanceof Error ? error.message : 'unknown error';
      strapi.log.error(
        `[form-retention] ${uid}: purge failed after ${result.deleted} deletion(s): ${result.error}`,
      );
    }
    results.push(result);
  }

  return { dryRun: config.dryRun, cutoff: cutoff.toISOString(), results };
};
