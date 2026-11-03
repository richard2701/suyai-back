import { purgeConfigFromEnv, purgeFormSubmissions } from '../src/utils/purge-form-submissions';

export default {
  /**
   * Form submission retention purge (issue #73). Daily at 03:00 server time.
   * Deletes nothing unless FORM_RETENTION_DRY_RUN=false. See docs/form-retention.md.
   */
  purgeFormSubmissions: {
    task: async ({ strapi }: { strapi: any }) => {
      const config = purgeConfigFromEnv(process.env);
      const raw = process.env.FORM_RETENTION_DAYS;
      // Surface a bad value instead of silently falling back to the default.
      if (raw !== undefined && raw.trim() !== '' && Number(raw) !== config.retentionDays) {
        strapi.log.warn(`[form-retention] Invalid FORM_RETENTION_DAYS, using ${config.retentionDays} days`);
      }
      await purgeFormSubmissions(strapi, config);
    },
    options: { rule: '0 3 * * *' },
  },
};
