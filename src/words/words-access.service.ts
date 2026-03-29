import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { Permissions } from '../users/constants/permissions.constants';
import { roleNamesIncludeTutorEligible } from '../users/constants/roles.constants';
import { UsersService } from '../users/users.service';

export interface WordsAccessContext {
  effectiveStudentId: Types.ObjectId;
  /**
   * Tutor/admin principals are always read-only on their own vocabulary (`words:write` applies to tutees only).
   * Non–tutor-eligible users: read-only when `words:write` is missing.
   */
  isSelfReadOnly: boolean;
}

@Injectable()
export class WordsAccessService {
  constructor(private readonly usersService: UsersService) {}

  async resolveAccess(
    email: string,
    studentIdParam?: string,
  ): Promise<WordsAccessContext> {
    const user = await this.usersService.findByEmailWithRolesPopulated(email);
    if (!user || !user._id) {
      throw new ForbiddenException('User not found');
    }
    const selfId = user._id;
    const roleNames = this.extractRoleNames(user);
    const permissions = await this.usersService.getPermissionNamesForUser(user);
    const hasWordsRead = permissions.has(Permissions.WORDS_READ);
    const hasWordsWrite = permissions.has(Permissions.WORDS_WRITE);
    const isTutorPrincipal = roleNamesIncludeTutorEligible(roleNames);

    const tutees = await this.usersService.findTuteesByTutorId(selfId);
    const tuteeIdSet = new Set(tutees.map((t) => t._id));

    const trimmed = studentIdParam?.trim() ?? '';
    const emptyStudentParam = trimmed === '';
    if (emptyStudentParam && isTutorPrincipal && tutees.length > 0) {
      throw new BadRequestException('studentId is required');
    }
    if (emptyStudentParam && !hasWordsRead) {
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
    if (targetIsSelf && !hasWordsRead) {
      throw new ForbiddenException('No access');
    }
    if (targetIsSelf) {
      return {
        effectiveStudentId: sid,
        isSelfReadOnly: isTutorPrincipal ? true : !hasWordsWrite,
      };
    }

    if (!hasWordsRead) {
      throw new ForbiddenException('No access');
    }
    if (!tuteeIdSet.has(trimmed)) {
      throw new ForbiddenException('Not a student of this tutor');
    }
    return {
      effectiveStudentId: sid,
      isSelfReadOnly: !hasWordsWrite,
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
