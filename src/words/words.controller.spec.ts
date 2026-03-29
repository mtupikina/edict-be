import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import type { JwtPayload } from '../auth/auth.service';
import { WordsAccessService } from './words-access.service';
import { WordsController } from './words.controller';
import { WordsPage, WordsService } from './words.service';

describe('WordsController', () => {
  let controller: WordsController;

  const jwtUser: JwtPayload = { email: 'u@x.com', sub: 'sub-1' };
  const studentOid = new Types.ObjectId('507f1f77bcf86cd799439099');

  const toVerifyList = [
    {
      _id: '1',
      word: 'hello',
      translation: 'привіт',
      lastVerifiedAt: null,
      canEToU: false,
      canUToE: false,
      toVerifyNextTime: true,
    },
  ];
  const quizWords = [
    {
      _id: '2',
      word: 'world',
      translation: 'світ',
      canEToU: false,
      canUToE: false,
      lastVerifiedAt: null,
    },
  ];
  const mockWordsService = {
    findAll: jest.fn().mockResolvedValue({
      items: [{ _id: '1', word: 'hello', translation: 'привіт' }],
      nextCursor: null,
      hasMore: false,
      totalCount: 1,
    }),
    findOne: jest.fn().mockResolvedValue({ _id: '1', word: 'hello' }),
    create: jest.fn().mockResolvedValue({ _id: '1', word: 'hello' }),
    update: jest
      .fn()
      .mockResolvedValue({ _id: '1', word: 'hello', translation: 'updated' }),
    remove: jest.fn().mockResolvedValue(undefined),
    findToVerifyList: jest.fn().mockResolvedValue(toVerifyList),
    generateVerifyQuiz: jest.fn().mockResolvedValue(quizWords),
    submitVerifyQuiz: jest.fn().mockResolvedValue(undefined),
  };

  const mockWordsAccess = {
    resolveAccess: jest.fn().mockResolvedValue({
      effectiveStudentId: studentOid,
      isSelfReadOnly: false,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordsController],
      providers: [
        { provide: WordsService, useValue: mockWordsService },
        { provide: WordsAccessService, useValue: mockWordsAccess },
      ],
    }).compile();

    controller = module.get<WordsController>(WordsController);
    jest.clearAllMocks();
    mockWordsAccess.resolveAccess.mockResolvedValue({
      effectiveStudentId: studentOid,
      isSelfReadOnly: false,
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated words', async () => {
      const result = (await controller.findAll(
        jwtUser,
        '20',
        undefined,
      )) as unknown as WordsPage;
      expect(result).toEqual({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        items: expect.any(Array),
        nextCursor: null,
        hasMore: false,
        totalCount: 1,
      });
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        20,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass cursor to service', async () => {
      await controller.findAll(jwtUser, '10', 'abc123');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        10,
        'abc123',
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass undefined cursor when cursor is empty string', async () => {
      await controller.findAll(jwtUser, '10', '');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        10,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should clamp limit and pass sortBy and order', async () => {
      await controller.findAll(jwtUser, '200', undefined, 'word', 'asc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        100,
        undefined,
        'word',
        'asc',
        undefined,
      );
    });

    it('should use default sortBy when invalid', async () => {
      await controller.findAll(
        jwtUser,
        '5',
        undefined,
        'invalid' as 'word',
        'desc',
      );
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        5,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should clamp limit to 1 when below minimum', async () => {
      await controller.findAll(jwtUser, '0', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        1,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should use default limit 20 when limit string is empty', async () => {
      await controller.findAll(jwtUser, '', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        20,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass order asc when provided', async () => {
      await controller.findAll(jwtUser, '5', undefined, 'translation', 'asc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        5,
        undefined,
        'translation',
        'asc',
        undefined,
      );
    });

    it('should use default order when invalid', async () => {
      await controller.findAll(
        jwtUser,
        '5',
        undefined,
        'word',
        'invalid' as 'asc',
      );
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        5,
        undefined,
        'word',
        'desc',
        undefined,
      );
    });

    it('should use default limit 20 and createdAt when limit/sortBy omitted', async () => {
      await controller.findAll(jwtUser, undefined, undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        20,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass limit 1 when limit is 1', async () => {
      await controller.findAll(jwtUser, '1', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        1,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass limit 100 when limit is 100', async () => {
      await controller.findAll(jwtUser, '100', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        100,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should use default sortBy when sortBy is null', async () => {
      await controller.findAll(
        jwtUser,
        '10',
        undefined,
        null as unknown as string,
        undefined,
      );
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        10,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass sortBy createdAt when provided', async () => {
      await controller.findAll(jwtUser, '10', undefined, 'createdAt', 'desc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        10,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass parsed limit when limit string given', async () => {
      await controller.findAll(jwtUser, 'abc', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        expect.any(Number),
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass search to service when provided', async () => {
      await controller.findAll(
        jwtUser,
        '20',
        undefined,
        'createdAt',
        'desc',
        'hello',
      );
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        20,
        undefined,
        'createdAt',
        'desc',
        'hello',
      );
    });

    it('should pass undefined search when search is empty or whitespace', async () => {
      await controller.findAll(
        jwtUser,
        '20',
        undefined,
        undefined,
        undefined,
        '   ',
      );
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        studentOid,
        20,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('should return a word', async () => {
      const result = await controller.findOne(jwtUser, '1');
      expect(result).toEqual({ _id: '1', word: 'hello' });
      expect(mockWordsService.findOne).toHaveBeenCalledWith(studentOid, '1');
    });
  });

  describe('create', () => {
    it('should create a word', async () => {
      const dto = { word: 'test', translation: 'тест' };
      const result = await controller.create(jwtUser, dto);
      expect(result).toEqual({ _id: '1', word: 'hello' });
      expect(mockWordsService.create).toHaveBeenCalledWith(studentOid, dto);
    });

    it('should reject when self read-only', async () => {
      mockWordsAccess.resolveAccess.mockResolvedValueOnce({
        effectiveStudentId: studentOid,
        isSelfReadOnly: true,
      });
      await expect(controller.create(jwtUser, { word: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update a word', async () => {
      const result = await controller.update(jwtUser, '1', {
        translation: 'updated',
      });
      expect(result.translation).toBe('updated');
      expect(mockWordsService.update).toHaveBeenCalledWith(studentOid, '1', {
        translation: 'updated',
      });
    });
  });

  describe('remove', () => {
    it('should delete a word', async () => {
      const result = await controller.remove(jwtUser, '1');
      expect(result).toEqual({ message: 'Word deleted successfully' });
      expect(mockWordsService.remove).toHaveBeenCalledWith(studentOid, '1');
    });
  });

  describe('getToVerifyList', () => {
    it('should return list of words to verify', async () => {
      const result = await controller.getToVerifyList(jwtUser);
      expect(result).toEqual(toVerifyList);
      expect(mockWordsService.findToVerifyList).toHaveBeenCalledWith(
        studentOid,
      );
    });
  });

  describe('generateVerifyQuiz', () => {
    it('should generate quiz with default count', async () => {
      const result = await controller.generateVerifyQuiz(jwtUser, {});
      expect(result).toEqual(quizWords);
      expect(mockWordsService.generateVerifyQuiz).toHaveBeenCalledWith(
        studentOid,
        50,
      );
    });

    it('should generate quiz with given count', async () => {
      await controller.generateVerifyQuiz(jwtUser, { count: 20 });
      expect(mockWordsService.generateVerifyQuiz).toHaveBeenCalledWith(
        studentOid,
        20,
      );
    });
  });

  describe('submitVerifyQuiz', () => {
    it('should submit quiz updates', async () => {
      const dto = {
        updates: [
          {
            wordId: '2',
            word: 'world',
            translation: 'світ',
            canEToU: true,
            canUToE: false,
            toVerifyNextTime: true,
          },
        ],
      };
      await controller.submitVerifyQuiz(jwtUser, dto);
      expect(mockWordsService.submitVerifyQuiz).toHaveBeenCalledWith(
        studentOid,
        dto.updates,
        undefined,
      );
    });

    it('should reject submit when self read-only', async () => {
      mockWordsAccess.resolveAccess.mockResolvedValueOnce({
        effectiveStudentId: studentOid,
        isSelfReadOnly: true,
      });
      await expect(
        controller.submitVerifyQuiz(jwtUser, { updates: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should pass tutorId when access is for a tutee', async () => {
      const tuteeOid = new Types.ObjectId('507f1f77bcf86cd7994390bb');
      const tutorPrincipalOid = new Types.ObjectId('507f1f77bcf86cd7994390cc');
      mockWordsAccess.resolveAccess.mockResolvedValueOnce({
        effectiveStudentId: tuteeOid,
        isSelfReadOnly: false,
        tutorId: tutorPrincipalOid,
      });
      const dto = {
        updates: [{ wordId: '2', word: 'w', canEToU: true }],
      };
      await controller.submitVerifyQuiz(jwtUser, dto);
      expect(mockWordsService.submitVerifyQuiz).toHaveBeenCalledWith(
        tuteeOid,
        dto.updates,
        tutorPrincipalOid,
      );
    });
  });
});
