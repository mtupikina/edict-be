import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  ROLES,
  roleNamesIncludeStudent,
  roleNamesIncludeTutorEligible,
} from './constants/roles.constants';
import { AuthSessionDto, AuthSessionStudentRef } from './dto/auth-session.dto';
import {
  RolePermission,
  RolePermissionDocument,
} from './schemas/role-permission.schema';
import { User, UserDocument } from './schemas/user.schema';

export type UserWithRoleNames = User & {
  _id: Types.ObjectId;
  roleIds: { _id: Types.ObjectId; name: string }[] | Types.ObjectId[];
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(RolePermission.name)
    private readonly rolePermissionModel: Model<RolePermissionDocument>,
  ) {}

  async isUserAllowed(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).exec();
    return !!user;
  }

  async findByEmailWithRolesPopulated(
    email: string,
  ): Promise<UserWithRoleNames | null> {
    const user = await this.userModel
      .findOne({ email })
      .populate({ path: 'roleIds', select: 'name' })
      .lean()
      .exec();
    return user as UserWithRoleNames | null;
  }

  /**
   * Permission names from `role_permissions` only (same DB as edict-admin-be).
   * Returned as a set (deduped once). No role-name inference: empty join → empty set.
   */
  async getPermissionNamesForUser(
    user: UserWithRoleNames,
  ): Promise<ReadonlySet<string>> {
    const roleIds = this.extractRoleObjectIds(user);
    if (roleIds.length === 0) {
      return new Set();
    }
    const links = await this.rolePermissionModel
      .find({ roleId: { $in: roleIds } })
      .populate({ path: 'permissionId', select: 'name' })
      .lean()
      .exec();
    return new Set(
      links
        .map((l) => (l.permissionId as { name?: string })?.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0),
    );
  }

  async findTuteesByTutorId(
    tutorId: Types.ObjectId,
  ): Promise<AuthSessionStudentRef[]> {
    const docs = await this.userModel
      .find({ tutorIds: tutorId })
      .select('firstName lastName email')
      .lean()
      .exec();
    return docs.map((d) => ({
      _id: String((d as { _id: Types.ObjectId })._id),
      firstName: (d as { firstName: string }).firstName,
      lastName: (d as { lastName: string }).lastName,
      email: (d as { email: string }).email,
    }));
  }

  private extractRoleObjectIds(user: UserWithRoleNames): Types.ObjectId[] {
    const roles = user.roleIds;
    if (!Array.isArray(roles)) {
      return [];
    }
    return roles
      .map((r) => {
        if (r instanceof Types.ObjectId) {
          return r;
        }
        if (typeof r === 'object' && r !== null && '_id' in r) {
          return (r as { _id: Types.ObjectId })._id;
        }
        return null;
      })
      .filter((id): id is Types.ObjectId => id !== null);
  }

  private extractRoleNames(user: UserWithRoleNames): string[] {
    const roles = user.roleIds;
    if (!Array.isArray(roles)) {
      return [];
    }
    return roles
      .map((r) =>
        typeof r === 'object' && r !== null && 'name' in r
          ? (r as { name: string }).name
          : null,
      )
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
  }

  async getAuthSession(email: string): Promise<AuthSessionDto | null> {
    const user = await this.findByEmailWithRolesPopulated(email);
    if (!user || !user._id) {
      return null;
    }
    const userId = user._id;
    const roleNames = this.extractRoleNames(user);
    const isStudent = roleNamesIncludeStudent(roleNames);
    const isTutorEligible = roleNamesIncludeTutorEligible(roleNames);
    const students = await this.findTuteesByTutorId(userId);
    const hasTutees = students.length > 0;
    const showTutorMode = isTutorEligible && hasTutees;
    /** Tutor/admin with no assigned students still use the app with their own vocabulary (read-only student-style access). */
    const showStudentMode = isStudent || (isTutorEligible && !hasTutees);
    const defaultMode = showTutorMode ? ROLES.TUTOR : ROLES.STUDENT;
    return {
      userId: userId.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleNames,
      showTutorMode,
      showStudentMode,
      defaultMode,
      students,
    };
  }
}
