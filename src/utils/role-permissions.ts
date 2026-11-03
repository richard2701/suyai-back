/**
 * Least-privilege enforcement for the users-permissions Public and Authenticated roles.
 *
 * Role permissions live in the database, so they drift between environments and can be
 * re-opened from the admin panel or by a DB restore. The site has no end-user accounts,
 * so these grants are never legitimate: form submissions go through `auth: false` GraphQL
 * mutations, and uploads/user listings are admin-only. `enforceRolePermissions` runs on every
 * boot and revokes them.
 */

// Action prefixes (UID + '.') denied for BOTH roles.
const DENIED_FOR_ALL_ROLES: readonly string[] = [
  'api::form-contact.',
  'api::form-reservation-tour.',
  'api::form-reservation-transfer.',
  'api::form.',
  'api::feature-flag-token.',
  'plugin::upload.',
  'plugin::users-permissions.user.find',
  'plugin::users-permissions.user.findOne',
];

// Exact actions denied only for the Public role (self-service account flows).
const DENIED_FOR_PUBLIC: readonly string[] = [
  'plugin::users-permissions.auth.register',
  'plugin::users-permissions.auth.connect',
  'plugin::users-permissions.auth.forgotPassword',
];

export const shouldRevokePermission = (roleType: string, action: string): boolean => {
  if (roleType !== 'public' && roleType !== 'authenticated') return false;
  if (DENIED_FOR_ALL_ROLES.some((prefix) => action.startsWith(prefix))) return true;
  return roleType === 'public' && DENIED_FOR_PUBLIC.includes(action);
};

interface PermissionRow {
  id: number | string;
  action: string;
}

interface RoleRow {
  id: number | string;
  type: string;
}

interface SettingsStore {
  get: (params: { key: string }) => Promise<Record<string, unknown> | null>;
  set: (params: { key: string; value: Record<string, unknown> }) => Promise<void>;
}

export interface PermissionsStrapi {
  db: {
    query: (uid: string) => {
      findMany: (params: Record<string, unknown>) => Promise<unknown[]>;
      delete: (params: Record<string, unknown>) => Promise<unknown>;
    };
  };
  store: (params: { type: string; name: string }) => SettingsStore;
  log: { info: (msg: string) => void; warn: (msg: string) => void };
}

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';

export const enforceRolePermissions = async (strapi: PermissionsStrapi): Promise<void> => {
  const roles = (await strapi.db.query(ROLE_UID).findMany({
    where: { type: { $in: ['public', 'authenticated'] } },
  })) as RoleRow[];

  for (const role of roles) {
    const permissions = (await strapi.db
      .query(PERMISSION_UID)
      .findMany({ where: { role: role.id } })) as PermissionRow[];

    const revoked = permissions.filter((p) => shouldRevokePermission(role.type, p.action));
    for (const permission of revoked) {
      await strapi.db.query(PERMISSION_UID).delete({ where: { id: permission.id } });
    }
    if (revoked.length > 0) {
      strapi.log.warn(
        `[permissions] revoked from ${role.type}: ${revoked.map((p) => p.action).join(', ')}`,
      );
    }
    if (role.type === 'authenticated') {
      const kept = permissions.filter((p) => !revoked.includes(p)).map((p) => p.action);
      strapi.log.info(`[permissions] authenticated grants kept (review): ${kept.join(', ') || 'none'}`);
    }
  }

  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const advanced = (await store.get({ key: 'advanced' })) ?? {};
  if (advanced.allow_register !== false) {
    await store.set({ key: 'advanced', value: { ...advanced, allow_register: false } });
    strapi.log.warn('[permissions] self-registration disabled (allow_register=false)');
  }
};
