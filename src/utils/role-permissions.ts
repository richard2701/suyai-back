/**
 * Least-privilege enforcement for the users-permissions Public and Authenticated roles.
 *
 * Role permissions live in the database, so they drift between environments and can be
 * re-opened from the admin panel or by a DB restore. The site has no end-user accounts,
 * so these grants are never legitimate: form submissions go through `auth: false` GraphQL
 * mutations, and uploads/user management are admin-only. `enforceRolePermissions` runs once
 * per boot and revokes them. It does NOT watch for later changes: a grant re-added in the
 * admin panel survives until the next restart.
 */
import type { Core } from '@strapi/strapi';

const U_P = 'plugin::users-permissions.';

// Action prefixes (UID + '.') denied for BOTH roles.
const DENIED_FOR_ALL_ROLES: readonly string[] = [
  'api::form-contact.',
  'api::form-reservation-tour.',
  'api::form-reservation-transfer.',
  'api::form.',
  'api::feature-flag-token.',
  'plugin::upload.',
  `${U_P}role.`,
];

// Public has no reason to touch user records or any auth flow except login (`auth.callback`).
const PUBLIC_ALLOWED_U_P_ACTIONS: readonly string[] = [`${U_P}auth.callback`];

// Authenticated may only read its own profile; every other user action
// (find, findOne, count, create, update, destroy) is denied.
const AUTHENTICATED_ALLOWED_U_P_USER_ACTIONS: readonly string[] = [`${U_P}user.me`];

export const shouldRevokePermission = (roleType: string, action: string): boolean => {
  if (roleType !== 'public' && roleType !== 'authenticated') return false;
  if (DENIED_FOR_ALL_ROLES.some((prefix) => action.startsWith(prefix))) return true;

  if (roleType === 'public') {
    return action.startsWith(U_P) && !PUBLIC_ALLOWED_U_P_ACTIONS.includes(action);
  }
  return (
    action.startsWith(`${U_P}user.`) && !AUTHENTICATED_ALLOWED_U_P_USER_ACTIONS.includes(action)
  );
};

export type PermissionsStrapi = Pick<Core.Strapi, 'db' | 'store' | 'log'>;

interface PermissionRow {
  id: number | string;
  action: string;
}

interface RoleRow {
  id: number | string;
  type: string;
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
    if (revoked.length > 0) {
      await strapi.db
        .query(PERMISSION_UID)
        .deleteMany({ where: { id: { $in: revoked.map((p) => p.id) } } });
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
  const advanced = (await store.get({ key: 'advanced' })) as Record<string, unknown> | null;
  if (!advanced) {
    // Never write a partial object: it would replace the plugin defaults (default_role,
    // unique_email, reset-password URL, ...). The plugin creates the key on its own bootstrap.
    strapi.log.warn('[permissions] users-permissions "advanced" settings missing; sign-up not changed');
    return;
  }
  if (advanced.allow_register !== false) {
    await store.set({ key: 'advanced', value: { ...advanced, allow_register: false } });
    strapi.log.warn('[permissions] self-registration disabled (allow_register=false)');
  }
};
