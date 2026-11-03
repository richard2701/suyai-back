import type { Core } from '@strapi/strapi';
import { describe, expect, it, vi } from 'vitest';
import { enforceRolePermissions, shouldRevokePermission } from './role-permissions';

describe('shouldRevokePermission', () => {
  it.each([
    ['public', 'api::form-contact.form-contact.create'],
    ['public', 'api::form-reservation-tour.form-reservation-tour.find'],
    ['public', 'api::form-reservation-transfer.form-reservation-transfer.findOne'],
    ['public', 'api::form.form.create'],
    ['public', 'api::feature-flag-token.feature-flag-token.find'],
    ['public', 'plugin::upload.content-api.upload'],
    ['public', 'plugin::users-permissions.user.find'],
    ['public', 'plugin::users-permissions.user.count'],
    ['public', 'plugin::users-permissions.user.me'],
    ['public', 'plugin::users-permissions.role.find'],
    ['public', 'plugin::users-permissions.auth.register'],
    ['public', 'plugin::users-permissions.auth.connect'],
    ['public', 'plugin::users-permissions.auth.forgotPassword'],
    ['public', 'plugin::users-permissions.auth.resetPassword'],
    ['public', 'plugin::users-permissions.auth.emailConfirmation'],
    ['public', 'plugin::users-permissions.auth.sendEmailConfirmation'],
    ['authenticated', 'api::form-contact.form-contact.update'],
    ['authenticated', 'plugin::upload.content-api.destroy'],
    ['authenticated', 'plugin::users-permissions.user.find'],
    ['authenticated', 'plugin::users-permissions.user.findOne'],
    ['authenticated', 'plugin::users-permissions.user.create'],
    ['authenticated', 'plugin::users-permissions.user.update'],
    ['authenticated', 'plugin::users-permissions.user.destroy'],
    ['authenticated', 'plugin::users-permissions.user.count'],
    ['authenticated', 'plugin::users-permissions.role.find'],
  ])('revokes %s -> %s', (role, action) => {
    expect(shouldRevokePermission(role, action)).toBe(true);
  });

  it.each([
    ['public', 'api::article.article.find'],
    ['public', 'api::home.home.find'],
    ['public', 'plugin::users-permissions.auth.callback'],
    ['authenticated', 'plugin::users-permissions.user.me'],
    ['authenticated', 'plugin::users-permissions.auth.changePassword'],
    ['authenticated', 'api::article.article.find'],
    ['editor', 'plugin::upload.content-api.upload'],
    ['editor', 'plugin::users-permissions.user.update'],
  ])('keeps %s -> %s', (role, action) => {
    expect(shouldRevokePermission(role, action)).toBe(false);
  });
});

interface Harness {
  strapi: Pick<Core.Strapi, 'db' | 'store' | 'log'>;
  roleFindMany: ReturnType<typeof vi.fn>;
  permFindMany: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
}

const buildStrapi = (advanced: Record<string, unknown> | null): Harness => {
  const permissionsByRole: Record<number, { id: number; action: string }[]> = {
    1: [
      { id: 10, action: 'api::form-contact.form-contact.create' },
      { id: 11, action: 'api::article.article.find' },
      { id: 12, action: 'plugin::users-permissions.auth.register' },
    ],
    2: [
      { id: 20, action: 'plugin::upload.content-api.upload' },
      { id: 21, action: 'plugin::users-permissions.user.me' },
    ],
  };
  const roleFindMany = vi.fn().mockResolvedValue([
    { id: 1, type: 'public' },
    { id: 2, type: 'authenticated' },
  ]);
  const permFindMany = vi.fn(
    async (params: { where: { role: number } }) => permissionsByRole[params.where.role],
  );
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const set = vi.fn().mockResolvedValue(undefined);
  const warn = vi.fn();
  const strapi = {
    db: {
      query: (uid: string) =>
        uid === 'plugin::users-permissions.role'
          ? { findMany: roleFindMany }
          : { findMany: permFindMany, deleteMany },
    },
    store: () => ({ get: vi.fn().mockResolvedValue(advanced), set }),
    log: { info: vi.fn(), warn },
  } as unknown as Harness['strapi'];
  return { strapi, roleFindMany, permFindMany, deleteMany, set, warn };
};

describe('enforceRolePermissions', () => {
  it('only queries the public and authenticated roles', async () => {
    const { strapi, roleFindMany } = buildStrapi({ allow_register: false });
    await enforceRolePermissions(strapi);
    expect(roleFindMany).toHaveBeenCalledWith({
      where: { type: { $in: ['public', 'authenticated'] } },
    });
  });

  it('batch-deletes only the denied permission ids, per role', async () => {
    const { strapi, deleteMany } = buildStrapi({ allow_register: false });
    await enforceRolePermissions(strapi);
    expect(deleteMany).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { $in: [10, 12] } } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { $in: [20] } } });
  });

  it('disables registration and keeps the other advanced settings', async () => {
    const { strapi, set } = buildStrapi({ allow_register: true, default_role: 'authenticated' });
    await enforceRolePermissions(strapi);
    expect(set).toHaveBeenCalledWith({
      key: 'advanced',
      value: { allow_register: false, default_role: 'authenticated' },
    });
  });

  it('leaves settings alone when registration is already off', async () => {
    const { strapi, set } = buildStrapi({ allow_register: false });
    await enforceRolePermissions(strapi);
    expect(set).not.toHaveBeenCalled();
  });

  it('never writes a partial advanced object when the setting is missing', async () => {
    const { strapi, set, warn } = buildStrapi(null);
    await enforceRolePermissions(strapi);
    expect(set).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"advanced" settings missing'));
  });

  it('does not call deleteMany when nothing needs revoking', async () => {
    const { strapi, deleteMany, permFindMany } = buildStrapi({ allow_register: false });
    permFindMany.mockResolvedValue([{ id: 1, action: 'api::article.article.find' }]);
    await enforceRolePermissions(strapi);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
