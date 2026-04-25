import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Types } from 'mongoose';

import {
  Permissions,
  type PermissionName,
} from '../users/constants/permissions.constants';
import { roleNamesIncludeTutorEligible } from '../users/constants/roles.constants';
import { UsersService } from '../users/users.service';

import type { WordsAccessContext } from './words-access-context';

export type { WordsAccessContext } from './words-access-context';

@Injectable()
export class WordsAccessService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Resolve which student's data the caller may read.
   *
   * @param readPermissions - All of these must be held to grant read access.
   *   Defaults to `[WORDS_READ]`; pass `[WORDS_READ, TESTS_READ]` for stats
   *   endpoints that require access to both words and quiz data.
   */
  async resolveAccess(
    email: string,
    studentIdParam?: string,
    readPermissions: PermissionName[] = [Permissions.WORDS_READ],
  ): Promise<WordsAccessContext> {
    const user = await this.usersService.findByEmailWithRolesPopulated(email);
    if (!user || !user._id) {
      throw new ForbiddenException('User not found');
    }
    const selfId = user._id;
    const roleNames = this.extractRoleNames(user);
    const permissions = await this.usersService.getPermissionNamesForUser(user);
    const hasReadAccess = readPermissions.every((p) => permissions.has(p));
    const hasWordsWrite = permissions.has(Permissions.WORDS_WRITE);
    const isTutorPrincipal = roleNamesIncludeTutorEligible(roleNames);

    const tutees = await this.usersService.findTuteesByTutorId(selfId);
    const tuteeIdSet = new Set(tutees.map((t) => t._id));

    const trimmed = studentIdParam?.trim() ?? '';
    const emptyStudentParam = trimmed === '';
    if (emptyStudentParam && isTutorPrincipal && tutees.length > 0) {
      throw new BadRequestException('studentId is required');
    }
    if (emptyStudentParam && !hasReadAccess) {
      throw new ForbiddenException('No access');
    }
    if (emptyStudentParam) {
      return {
        effectiveStudentId: selfId,
        isSelfReadOnly: isTutorPrincipal ? true : !hasWordsWrite,
      };
    }

    if (!Types.ObjectId.isValid(trimmed)) {
      throw new BadRequestException('Invalid studentId');
    }

    const sid = new Types.ObjectId(trimmed);
    const targetIsSelf = sid.equals(selfId);
    if (targetIsSelf && !hasReadAccess) {
      throw new ForbiddenException('No access');
    }
    if (targetIsSelf) {
      return {
        effectiveStudentId: sid,
        isSelfReadOnly: isTutorPrincipal ? true : !hasWordsWrite,
      };
    }

    if (!hasReadAccess) {
      throw new ForbiddenException('No access');
    }
    if (!tuteeIdSet.has(trimmed)) {
      throw new ForbiddenException('Not a student of this tutor');
    }
    return {
      effectiveStudentId: sid,
      isSelfReadOnly: !hasWordsWrite,
      tutorId: selfId,
    };
  }

  private extractRoleNames(user: {
    roleIds?: { name: string }[] | Types.ObjectId[];
  }): string[] {
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
}
