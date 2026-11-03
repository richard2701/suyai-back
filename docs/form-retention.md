# Form submission retention (issue #73)

Contact, tour and transfer submissions store PII (name, email, phone, free text). A scheduled
job deletes submissions older than a retention period.

Code: `src/utils/purge-form-submissions.ts` (logic), `config/cron-tasks.ts` (schedule, daily
03:00 server time), `config/server.ts` (`cron.enabled`).

## Knobs

| Variable | Default | Meaning |
|----------|---------|---------|
| `FORM_RETENTION_DAYS` | `365` | **Placeholder. The owner must decide.** Invalid values fall back to 365. |
| `FORM_RETENTION_DRY_RUN` | `true` | Deletes nothing while `true`. Only the literal `false` enables deletion; any other value (typo, empty) keeps dry run on. |

Fixed in code: batches of 50, hard cap of 500 documents per content type per run (a backlog is
cleared over several daily runs). Constants `DEFAULT_BATCH_SIZE` / `DEFAULT_MAX_PER_RUN`.

## How it works

For each of the three form content-types it filters `createdAt < now - FORM_RETENTION_DAYS`
via the Document Service and deletes by `documentId`. Because the types use draftAndPublish,
this removes both the draft and the published row. Logs contain only the content-type uid,
counts and the cutoff date, never names, emails, messages or ids. A failure on one type is
logged and the other types still run.

## Running a dry run

1. Leave `FORM_RETENTION_DRY_RUN` unset (or `true`) and deploy.
2. At the next 03:00 run, look for log lines like
   `[form-retention] DRY RUN api::form-contact.form-contact: 12 document(s) would be deleted (created before 2025-...)`.
3. Locally: set `FORM_RETENTION_DAYS=1`, start Strapi against a throwaway local database (never
   production), submit a test form, and temporarily change the rule in `config/cron-tasks.ts`
   to `* * * * *` to see the log within a minute. Revert the rule afterwards.
4. Enable deletion only after the counts look right: set `FORM_RETENTION_DRY_RUN=false`.

## Owner decisions still needed

- **Retention period.** The ticket suggests e.g. 24 months for bookings and 12 for contact.
  Today a single value applies to all three types; per-type periods need a small code change.
- **Delete vs anonymize.** Current behavior is hard delete. Anonymizing (blank PII fields, keep
  aggregate data) would need a different purge step.
- **Export before delete.** Nothing is archived. Decide whether a backup/export is required
  before records are removed (the production DB backups may also retain deleted data).
- **Per-person erasure procedure.** Not implemented here (issue #73 requirement). Needs a
  documented lookup by email across the three collections.
- **Privacy page.** The FE privacy page must state the chosen period and stay in sync.

## Operational caveats

- The job runs inside the web process. If the Render instance sleeps (free plan) the job does not
  run while it is asleep.
- With more than one instance, each runs the job. Deletes are idempotent, but a delete racing
  another delete can log an error for that type. Keep a single instance or move to a Render cron job.
- Purged data is irreversible from the application. Take a database backup before the first live run.
