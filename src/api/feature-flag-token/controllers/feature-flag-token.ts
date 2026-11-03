/**
 * feature-flag-token controller
 *
 * Public:        GET  /api/feature-flag-tokens/validate?token=...
 * Admin only:    POST /api/feature-flag-tokens/generate
 *                GET  /api/feature-flag-tokens
 *                PUT  /api/feature-flag-tokens/:id
 *
 * Routes are registered with `auth: false` so the users-permissions plugin does
 * not block them; admin-only endpoints are gated here by verifying the Strapi
 * admin access token through the admin session manager, so token data is
 * never exposed through the public Users & Permissions roles.
 */

import { factories } from '@strapi/strapi';
import type { Context } from 'koa';
import { resolveAdminUser } from '../utils/admin-auth';

const UID = 'api::feature-flag-token.feature-flag-token' as const;

type ValidateReason = 'expired' | 'not_found' | 'revoked';

export default factories.createCoreController(UID, ({ strapi }) => {
  /**
   * Returns the active admin user for a valid admin access token, or null otherwise.
   * Uses the admin session manager, mirroring Strapi's own admin auth strategy. Every null
   * case is "not authenticated" (the strategy returns `authenticated: false` for all of them),
   * so callers answer 401: the admin fetch client (getFetchClient) only refreshes the
   * short-lived access token and retries on 401, never on 403.
   */
  const getAdminUser = (ctx: Context) => resolveAdminUser(strapi, ctx.request.header.authorization);

  /** Shape returned to the admin page (flat — Strapi v5 has no `attributes` wrapper). */
  const present = (record: Record<string, unknown>) => ({
    id: record.id,
    documentId: record.documentId,
    label: record.label ?? '',
    expiresAt: record.expiresAt,
    active: record.active,
    createdAt: record.createdAt,
  });

  return {
    async generate(ctx: Context) {
      const admin = await getAdminUser(ctx);
      if (!admin) return ctx.unauthorized('Admin authentication required');

      const { label } = (ctx.request.body ?? {}) as { label?: string };
      const record = await strapi.service(UID).generateToken(label);

      ctx.body = {
        id: record.id,
        documentId: record.documentId,
        token: record.token,
        expiresAt: record.expiresAt,
        label: record.label,
      };
    },

    async validate(ctx: Context) {
      const { token } = ctx.query;
      if (!token || typeof token !== 'string') {
        return ctx.send({ valid: false, reason: 'not_found' as ValidateReason });
      }

      const records = await strapi.documents(UID).findMany({
        filters: { token },
        limit: 1,
      });
      const record = records?.[0];

      if (!record) return ctx.send({ valid: false, reason: 'not_found' as ValidateReason });
      if (!record.active) return ctx.send({ valid: false, reason: 'revoked' as ValidateReason });
      if (new Date(record.expiresAt) < new Date()) {
        return ctx.send({ valid: false, reason: 'expired' as ValidateReason });
      }
      return ctx.send({ valid: true, expiresAt: record.expiresAt });
    },

    async find(ctx: Context) {
      const admin = await getAdminUser(ctx);
      if (!admin) return ctx.unauthorized('Admin authentication required');

      const limitParam = Number((ctx.query?.pagination as { limit?: string })?.limit);
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 5;

      const records = await strapi.documents(UID).findMany({
        sort: { createdAt: 'desc' },
        limit,
      });

      ctx.body = { data: records.map(present) };
    },

    async update(ctx: Context) {
      const admin = await getAdminUser(ctx);
      if (!admin) return ctx.unauthorized('Admin authentication required');

      const { id } = ctx.params;
      const { active } = ((ctx.request.body ?? {}) as { data?: { active?: boolean } }).data ?? {};
      if (typeof active !== 'boolean') {
        return ctx.badRequest('`data.active` (boolean) is required');
      }

      const updated = await strapi.documents(UID).update({
        documentId: id,
        data: { active },
      });

      if (!updated) return ctx.notFound('Token not found');
      ctx.body = { data: present(updated) };
    },
  };
});
