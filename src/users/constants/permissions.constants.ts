/**
 * Permission `name` values in Mongo — keep in sync with
 * `edict-admin-be/src/permissions/constants/permissions.constants.ts`.
 */
export const Permissions = {
  WORDS_READ: 'words:read',
  WORDS_WRITE: 'words:write',
  TESTS_READ: 'tests:read',
  TESTS_WRITE: 'tests:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  PERMISSIONS_READ: 'permissions:read',
  PERMISSIONS_WRITE: 'permissions:write',
} as const;

export type PermissionName = (typeof Permissions)[keyof typeof Permissions];
