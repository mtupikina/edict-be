import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { UsersService } from './users.service';
import { User, UserRole } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: UserRole.STUDENT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const chain = (execResult: unknown) => ({
    exec: jest.fn().mockResolvedValue(execResult),
  });
  const leanChain = (execResult: unknown) => ({
    lean: jest.fn().mockReturnValue(chain(execResult)),
  });
  const mockUserModel = {
    findOne: jest.fn().mockImplementation(() => chain(null)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
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

  describe('findOneByEmail', () => {
    it('should return user when found', async () => {
      mockUserModel.findOne.mockReturnValueOnce(leanChain(mockUser));
      const result = await service.findOneByEmail('john@example.com');
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'john@example.com',
      });
    });

    it('should return null when user not found', async () => {
      mockUserModel.findOne.mockReturnValueOnce(leanChain(null));
      const result = await service.findOneByEmail('unknown@example.com');
      expect(result).toBeNull();
    });
  });
});
