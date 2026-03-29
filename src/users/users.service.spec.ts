import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { Types } from 'mongoose';

import { Permissions } from './constants/permissions.constants';
import { Permission } from './schemas/permission.schema';
import { ROLES } from './constants/roles.constants';
import { RolePermission } from './schemas/role-permission.schema';
import { User } from './schemas/user.schema';
import { UsersService, type UserWithRoleNames } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    roleIds: [new Types.ObjectId('507f1f77bcf86cd799439012')],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const chain = (execResult: unknown) => ({
    exec: jest.fn().mockResolvedValue(execResult),
  });
  const mockUserModel = {
    findOne: jest.fn().mockImplementation(() => chain(null)),
  };

  const mockRolePermissionExec = jest.fn().mockResolvedValue([]);
  const mockRolePermissionModel = {
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: mockRolePermissionExec,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Permission.name),
          useValue: {},
        },
        {
          provide: getModelToken(RolePermission.name),
          useValue: mockRolePermissionModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
    mockRolePermissionExec.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isUserAllowed', () => {
    it('should return true when user exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(mockUser));
      const result = await service.isUserAllowed('john@example.com');
      expect(result).toBe(true);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'john@example.com',
      });
    });

    it('should return false when user does not exist', async () => {
      const result = await service.isUserAllowed('unknown@example.com');
      expect(result).toBe(false);
    });

    it('should return false when findOne returns undefined', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(undefined));
      const result = await service.isUserAllowed('no@example.com');
      expect(result).toBe(false);
    });
  });

  describe('getPermissionNamesForUser', () => {
    it('resolves super_admin from role_permissions like admin', async () => {
      const superAdminRoleId = new Types.ObjectId('507f1f77bcf86cd7994390aa');
      mockRolePermissionExec.mockResolvedValue([
        { permissionId: { name: Permissions.WORDS_READ } },
        { permissionId: { name: Permissions.PERMISSIONS_READ } },
      ]);
      const user: UserWithRoleNames = {
        ...mockUser,
        roleIds: [{ _id: superAdminRoleId, name: ROLES.SUPER_ADMIN }],
      } as UserWithRoleNames;
      const result = await service.getPermissionNamesForUser(user);
      expect(mockRolePermissionModel.find).toHaveBeenCalledWith({
        roleId: { $in: [superAdminRoleId] },
      });
      expect(result.size).toBe(2);
      expect(result.has(Permissions.WORDS_READ)).toBe(true);
      expect(result.has(Permissions.PERMISSIONS_READ)).toBe(true);
    });

    it('returns names from role_permissions when links exist', async () => {
      mockRolePermissionExec.mockResolvedValue([
        { permissionId: { name: Permissions.WORDS_READ } },
        { permissionId: { name: Permissions.WORDS_WRITE } },
      ]);
      const roleId = new Types.ObjectId('507f1f77bcf86cd799439099');
      const user: UserWithRoleNames = {
        ...mockUser,
        roleIds: [{ _id: roleId, name: 'tutor' }],
      } as UserWithRoleNames;
      const result = await service.getPermissionNamesForUser(user);
      expect(mockRolePermissionModel.find).toHaveBeenCalledWith({
        roleId: { $in: [roleId] },
      });
      expect(result.has(Permissions.WORDS_READ)).toBe(true);
      expect(result.has(Permissions.WORDS_WRITE)).toBe(true);
    });

    it('returns empty when role_permission has no rows', async () => {
      mockRolePermissionExec.mockResolvedValue([]);
      const user: UserWithRoleNames = {
        ...mockUser,
        roleIds: [{ _id: new Types.ObjectId(), name: 'student' }],
      } as UserWithRoleNames;
      const result = await service.getPermissionNamesForUser(user);
      expect(result.size).toBe(0);
    });
  });
});
