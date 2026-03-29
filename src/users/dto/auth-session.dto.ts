import type { AuthSessionDefaultMode } from '../constants/roles.constants';

export interface AuthSessionStudentRef {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuthSessionDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
  showTutorMode: boolean;
  showStudentMode: boolean;
  defaultMode: AuthSessionDefaultMode;
  students: AuthSessionStudentRef[];
}
