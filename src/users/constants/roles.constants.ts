export const ROLES = {
  STUDENT: 'student',
  TUTOR: 'tutor',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

/** Session `defaultMode` values (same strings as tutor/student role names). */
export type AuthSessionDefaultMode =
  | (typeof ROLES)['TUTOR']
  | (typeof ROLES)['STUDENT'];

const TUTOR_ELIGIBLE = new Set<string>([
  ROLES.TUTOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
]);

export function roleNamesIncludeStudent(roleNames: string[]): boolean {
  return roleNames.includes(ROLES.STUDENT);
}

export function roleNamesIncludeTutorEligible(roleNames: string[]): boolean {
  return roleNames.some((n) => TUTOR_ELIGIBLE.has(n));
}
