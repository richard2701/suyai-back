import { describe, expect, it, vi } from 'vitest';
import {
  enforceRolePermissions,
  shouldRevokePermission,
  type PermissionsStrapi,
} from './role-permissions';

describe('shouldRevokePermission', () => {
  it.each([
    ['public', 'api::form-contact.form-contact.create'],
    ['public', 'api::form-reservation-tour.form-reservation-tour.find'],
    ['public', 'api::form-reservation-transfer.form-reservation-transfer.findOne'],
    ['public', 'api::form.form.create'],
    ['public', 'api::feature-flag-token.feature-flag-token.find'],
    ['public', 'plugin::upload.content-api.upload'],
    ['public', 'plugin::users-permissions.user.find'],
    ['public', 'plugin::users-permissions.auth.register'],
    ['public', 'plugin::users-permissions.auth.connect'],
    ['public', 'plugin::users-permissions.auth.forgotPassword'],
    ['authenticated', 'api::form-contact.form-contact.update'],
    ['authenticated', 'plugin::upload.content-api.destroy'],
    ['authenticated', 'plugin::users-permissions.user.findOne'],
  ])('revokes %s -> %s', (role, action) => {
    expect(shouldRevokePermission(role, action)).toBe(true);
  });

  it.each([
    ['public', 'api::article.article.find'],
    ['public', 'api::home.home.find'],
    ['public', 'plugin::users-permissions.auth.callback'],
    ['authenticated', 'plugin::users-permissions.user.me'],
    ['authenticated', 'plugin::users-permissions.auth.register'],
    ['editor', 'plugin::upload.content-api.upload'],
  ])('keeps %s -> %s', (role, action) => {
    expect(shouldRevokePermission(role, action)).toBe(false);
  });
});

const buildStrapi = (advanced: Record<string, unknown> | null) => {
  const del = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockResolvedValue(undefined);
  const permissionsByRole: Record<number, { id: number; action: string }[]> = {
    1: [
      { id: 10, action: 'api::form-contact.form-contact.create' },
      { id: 11, action: 'api::article.article.find' },
    ],
    2: [{ id: 20, action: 'plugin::upload.content-api.upload' }],
  };
  const strapi: PermissionsStrapi = {
    db: {
      query: (uid: string) => ({
        findMany: vi.fn(async (params: Record<string, unknown>) => {
          if (uid === 'plugin::users-permissions.role') {
            return [
              { id: 1, type: 'public' },
              { id: 2, type: 'authenticated' },
            ];
          }
          return permissionsByRole[(params.where as { role: number }).role];
        }),
        delete: del,
      }),
    },
    store: () => ({ get: vi.fn().mockResolvedValue(advanced), set }),
    log: { info: vi.fn(), warn: vi.fn() },
  };
  return { strapi, del, set };
};

describe('enforceRolePermissions', () => {
  it('deletes only denied permissions and disables registration', async () => {
    const { strapi, del, set } = buildStrapi({ allow_register: true, email_confirmation: false });
    await enforceRolePermissions(strapi);
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(del).toHaveBeenCalledWith({ where: { id: 20 } });
    expect(set).toHaveBeenCalledWith({
      key: 'advanced',
      value: { allow_register: false, email_confirmation: false },
    });
  });

  it('leaves settings alone when registration is already off', async () => {
    const { strapi, set } = buildStrapi({ allow_register: false });
    await enforceRolePermissions(strapi);
    expect(set).not.toHaveBeenCalled();
  });
});
