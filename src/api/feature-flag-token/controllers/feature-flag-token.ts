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
 * admin JWT, so token data is never exposed through the public Users &
 * Permissions roles.
 */

import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

const UID = 'api::feature-flag-token.feature-flag-token' as const;

type ValidateReason = 'expired' | 'not_found' | 'revoked';

export default factories.createCoreController(UID, ({ strapi }) => {
  /**
   * Returns the active admin user for a valid admin JWT, or null otherwise.
   * Verifies the bearer token against Strapi's admin token service.
   */
  const getAdminUser = async (ctx: Context) => {
    const authHeader = ctx.request.header.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const jwt = authHeader.slice('Bearer '.length).trim();
    if (!jwt) return null;

    try {
      const { isValid, payload } = strapi.service('admin::token').decodeJwtToken(jwt);
      if (!isValid || !payload?.id) return null;
      const adminUser = await strapi.db
        .query('admin::user')
        .findOne({ where: { id: payload.id } });
      if (!adminUser || adminUser.isActive === false) return null;
      return adminUser;
    } catch {
      return null;
    }
  };

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
      if (!admin) return ctx.forbidden('Admin access required');

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
      if (!admin) return ctx.forbidden('Admin access required');

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
      if (!admin) return ctx.forbidden('Admin access required');

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
