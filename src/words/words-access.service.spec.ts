import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { Permissions } from '../users/constants/permissions.constants';
import { UsersService } from '../users/users.service';
import { WordsAccessService } from './words-access.service';

/** Matches `UsersService.getPermissionNamesForUser` return type. */
function permissionSet(...names: string[]): ReadonlySet<string> {
  return new Set(names);
}

describe('WordsAccessService', () => {
  let service: WordsAccessService;
  const selfId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const tuteeId = new Types.ObjectId('507f1f77bcf86cd799439022');

  const mockUsersService = {
    findByEmailWithRolesPopulated: jest.fn(),
    findTuteesByTutorId: jest.fn(),
    getPermissionNamesForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordsAccessService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<WordsAccessService>(WordsAccessService);
    jest.clearAllMocks();
  });

  it('should resolve self read-only when student role and no studentId param', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 's@x.com',
      roleIds: [{ name: 'student' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    const result = await service.resolveAccess('s@x.com');
    expect(result.effectiveStudentId.equals(selfId)).toBe(true);
    expect(result.isSelfReadOnly).toBe(true);
  });

  it('should resolve self read-only when tutor-eligible with no tutees and no studentId', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 'admin@x.com',
      roleIds: [{ name: 'admin' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ, Permissions.WORDS_WRITE),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    const result = await service.resolveAccess('admin@x.com');
    expect(result.effectiveStudentId.equals(selfId)).toBe(true);
    expect(result.isSelfReadOnly).toBe(true);
  });

  it('should require studentId when tutor with tutees and no student role', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 't@x.com',
      roleIds: [{ name: 'tutor' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ, Permissions.WORDS_WRITE),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([
      {
        _id: tuteeId.toString(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@x.com',
      },
    ]);
    await expect(service.resolveAccess('t@x.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should resolve tutor access when studentId is a tutee', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 't@x.com',
      roleIds: [{ name: 'tutor' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ, Permissions.WORDS_WRITE),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([
      {
        _id: tuteeId.toString(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@x.com',
      },
    ]);
    const result = await service.resolveAccess('t@x.com', tuteeId.toString());
    expect(result.effectiveStudentId.equals(tuteeId)).toBe(true);
    expect(result.isSelfReadOnly).toBe(false);
  });

  it('should reject when tutee id is not in list', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 't@x.com',
      roleIds: [{ name: 'tutor' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ, Permissions.WORDS_WRITE),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    await expect(
      service.resolveAccess('t@x.com', tuteeId.toString()),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject when user not found', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue(null);
    await expect(service.resolveAccess('n@x.com')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should resolve tutee read-only when DB grants words:read but not words:write', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 't@x.com',
      roleIds: [{ name: 'tutor' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([
      {
        _id: tuteeId.toString(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@x.com',
      },
    ]);
    const result = await service.resolveAccess('t@x.com', tuteeId.toString());
    expect(result.effectiveStudentId.equals(tuteeId)).toBe(true);
    expect(result.isSelfReadOnly).toBe(true);
  });

  it('should allow self read for non-student role when words:read is granted', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 'guest@x.com',
      roleIds: [{ name: 'guest' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    const result = await service.resolveAccess('guest@x.com');
    expect(result.effectiveStudentId.equals(selfId)).toBe(true);
    expect(result.isSelfReadOnly).toBe(true);
  });

  it('should reject invalid studentId', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 's@x.com',
      roleIds: [{ name: 'student' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    await expect(service.resolveAccess('s@x.com', 'not-valid')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should forbid when words:read is missing (empty param)', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 'x@x.com',
      roleIds: [{ name: 'norole' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(new Set());
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    await expect(service.resolveAccess('x@x.com')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should forbid when roleIds is not an array', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 'x@x.com',
      roleIds: null as unknown as { name: string }[],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(new Set());
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    await expect(service.resolveAccess('x@x.com')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should forbid self studentId when words:read is not granted', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 't@x.com',
      roleIds: [{ name: 'tutor' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(new Set());
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    await expect(
      service.resolveAccess('t@x.com', selfId.toString()),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should forbid tutee id when words:read is not granted', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 's@x.com',
      roleIds: [{ name: 'student' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(new Set());
    mockUsersService.findTuteesByTutorId.mockResolvedValue([
      {
        _id: tuteeId.toString(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@x.com',
      },
    ]);
    await expect(
      service.resolveAccess('s@x.com', tuteeId.toString()),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow not read-only self when words:write is granted and user is not tutor-eligible', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 'w@x.com',
      roleIds: [{ name: 'author' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ, Permissions.WORDS_WRITE),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    const result = await service.resolveAccess('w@x.com');
    expect(result.isSelfReadOnly).toBe(false);
  });

  it('should allow student with tutor role to use own id as studentId', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 'both@x.com',
      roleIds: [{ name: 'student' }, { name: 'tutor' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ, Permissions.WORDS_WRITE),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    const result = await service.resolveAccess('both@x.com', selfId.toString());
    expect(result.effectiveStudentId.equals(selfId)).toBe(true);
    expect(result.isSelfReadOnly).toBe(true);
  });

  it('should allow tutor principal own id as studentId for read-only self vocabulary', async () => {
    mockUsersService.findByEmailWithRolesPopulated.mockResolvedValue({
      _id: selfId,
      email: 't@x.com',
      roleIds: [{ name: 'tutor' }],
    });
    mockUsersService.getPermissionNamesForUser.mockResolvedValue(
      permissionSet(Permissions.WORDS_READ, Permissions.WORDS_WRITE),
    );
    mockUsersService.findTuteesByTutorId.mockResolvedValue([]);
    const result = await service.resolveAccess('t@x.com', selfId.toString());
    expect(result.effectiveStudentId.equals(selfId)).toBe(true);
    expect(result.isSelfReadOnly).toBe(true);
  });
});
