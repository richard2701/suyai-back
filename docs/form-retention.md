# Form submission retention (issue #73)

Contact, tour and transfer submissions store PII (name, email, phone, free text). A scheduled
job deletes submissions older than a retention period.

Code: `src/utils/purge-form-submissions.ts` (logic), `config/cron-tasks.ts` (schedule, daily
03:00 server time), `config/server.ts` (`cron.enabled`).

## Knobs

| Variable | Default | Meaning |
|----------|---------|---------|
| `FORM_RETENTION_DAYS` | `365` | **Placeholder. The owner must decide.** Invalid values fall back to 365. |
| `FORM_RETENTION_DRY_RUN` | `true` | Deletes nothing while `true`. Only the word `false` (any letter case, surrounding spaces ignored) enables deletion; any other value (typo, empty) keeps dry run on. |

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

## Dry run on a production copy (2026-11-18)

Run locally against a scratch restore of `prod-2026-11-01.dump` (see `docs/backup-restore.md`),
calling `purgeFormSubmissions` with `dryRun: true` and `now = 2026-11-18`. Counts are documents
(a draft + published pair counts as one).

| Retention | Cutoff | form-contact | form-reservation-tour | form-reservation-transfer |
|-----------|--------|--------------|-----------------------|---------------------------|
| total stored | | 2 | 0 | 8 |
| 180 days | 2026-05-22 | 2 | 0 | 4 |
| 365 days | 2025-11-18 | 1 | 0 | 3 |
| 548 days | 2025-05-19 | 0 | 0 | 0 |
| 730 days | 2024-11-18 | 0 | 0 | 0 |

Oldest submission: 2025-07-20. The dump is from 2026-11-01, so production may hold a few newer
rows; that only changes totals, not what is past a cutoff.

## Per-person erasure request

1. Admin panel > Content Manager > each of Form Contact, Form Reservation Tour, Form
   Reservation Transfer > filter `email` equals the requester's address (also try `phone`).
2. Delete every match (deleting the entry removes draft and published versions).
3. Reply to the requester confirming deletion, and note that backups age out per
   `docs/backup-restore.md` section 2. Log only the date and the number of records, not the email.

## draftAndPublish removal rehearsal (#76, 2026-11-18)

Done on a scratch copy of the production dump, booting Strapi with `draftAndPublish: false` on
the three form types (not committed):

- Strapi **deletes every draft row** on boot and keeps the published rows. Row counts went
  contact 4 -> 2, transfer 16 -> 8; document counts unchanged (2 and 8).
- Every real submission had an identical draft + published pair (GraphQL create publishes), so
  no data was lost. Draft and published columns matched in 100% of pairs (incl. `email_sent`).
- A synthetic **draft-only** document (no published version) was **deleted**. So before shipping
  the change, run this read-only check on production and publish (or export) any hit first:

```sql
SELECT 'contact', count(*) FROM (SELECT document_id FROM form_contacts GROUP BY document_id HAVING count(published_at) = 0) x
UNION ALL SELECT 'tour', count(*) FROM (SELECT document_id FROM form_reservation_tours GROUP BY document_id HAVING count(published_at) = 0) x
UNION ALL SELECT 'transfer', count(*) FROM (SELECT document_id FROM form_reservation_transfers GROUP BY document_id HAVING count(published_at) = 0) x;
```

- The purge still works after the change: the dry run returned the same counts (`status:
  'draft'` is ignored for types without draftAndPublish).
- Rollback (verified on the scratch copy): re-enabling draftAndPublish makes Strapi recreate a draft copy of every published row (contact back to 4 rows, transfer to 16),
  so turning it back on loses nothing; the deleted draft rows themselves only come back from a
  backup. Take a dump right before deploying.

## Operational caveats

- The job runs inside the web process. If the Render instance sleeps (free plan) the job does not
  run while it is asleep.
- With more than one instance, each runs the job. Deletes are idempotent, but a delete racing
  another delete can log an error for that type. Keep a single instance or move to a Render cron job.
- Purged data is irreversible from the application. Take a database backup before the first live run.
