/**
 * Admin bearer-token verification for the feature-flag-token controller.
 *
 * Mirrors the official Strapi 5.60 admin auth strategy
 * (@strapi/admin/server/src/strategies/admin.ts): the access token is validated
 * by the admin session manager, its session must still be active, and the
 * referenced admin user must exist and be active. Any failure resolves to null
 * (fail closed).
 */

import type { Core } from '@strapi/strapi';

export interface AdminUser {
  id: number | string;
  isActive?: boolean;
  [key: string]: unknown;
}

export type AdminAuthStrapi = Pick<Core.Strapi, 'sessionManager' | 'db'>;

/** Extracts the token from a `Bearer <token>` header using the strategy's parsing rules. */
export const extractBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) return null;
  const parts = authorization.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) return null;
  return parts[1];
};

/** The session manager encodes numeric ids as strings; restore the number when lossless. */
const normalizeUserId = (rawUserId: string): number | string => {
  const numericUserId = Number(rawUserId);
  return Number.isFinite(numericUserId) && String(numericUserId) === rawUserId ? numericUserId : rawUserId;
};

export const resolveAdminUser = async (
  strapi: AdminAuthStrapi,
  authorization: string | undefined,
): Promise<AdminUser | null> => {
  const token = extractBearerToken(authorization);
  if (!token) return null;

  try {
    const manager = strapi.sessionManager;
    if (!manager) return null;

    const result = manager('admin').validateAccessToken(token);
    if (!result.isValid || !result.payload?.sessionId || !result.payload.userId) return null;

    const isActive = await manager('admin').isSessionActive(result.payload.sessionId);
    if (isActive !== true) return null;

    const user = (await strapi.db
      .query('admin::user')
      .findOne({ where: { id: normalizeUserId(result.payload.userId) } })) as AdminUser | null;

    if (!user || user.isActive !== true) return null;
    return user;
  } catch {
    return null;
  }
};
