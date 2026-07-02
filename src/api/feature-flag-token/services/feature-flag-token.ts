/**
 * feature-flag-token service
 */

import crypto from 'crypto';
import { factories } from '@strapi/strapi';

const UID = 'api::feature-flag-token.feature-flag-token' as const;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default factories.createCoreService(UID, ({ strapi }) => ({
  /**
   * Create a new feature flag token valid for 3 days.
   * Token is a 64-char hex secret generated with Node's crypto module.
   */
  async generateToken(label?: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + THREE_DAYS_MS).toISOString();

    return strapi.documents(UID).create({
      data: { token, expiresAt, label: label ?? '', active: true },
    });
  },
}));
