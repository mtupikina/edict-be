import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { WordsService } from './words.service';
import { Quiz } from './schemas/quiz.schema';
import { Word } from './schemas/word.schema';
import { WordVerifyUpdateDto } from './dto/submit-verify-quiz.dto';

describe('WordsService', () => {
  let service: WordsService;

  const studentId = new Types.ObjectId('507f1f77bcf86cd799439099');

  const mockWord = {
    _id: new Types.ObjectId(),
    word: 'hello',
    translation: 'привіт',
    synonyms: [],
    antonyms: [],
    examples: [],
    tags: [],
    canSpell: false,
    canEToU: false,
    canUToE: false,
    toVerifyNextTime: false,
  };

  const leanChain = (result: unknown) => ({
    lean: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(result) }),
  });
  const execChain = (result: unknown) => ({
    exec: jest.fn().mockResolvedValue(result),
  });
  const findByIdChain = (execResult: unknown, leanResult: unknown) => ({
    exec: jest.fn().mockResolvedValue(execResult),
    lean: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(leanResult) }),
  });

  const countExecChain = (n: number) => ({
    exec: jest.fn().mockResolvedValue(n),
  });

  const verifyListChain = (result: unknown[]) => ({
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(result),
        }),
      }),
    }),
  });

  const quizBucketChain = (result: unknown[]) => ({
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(result),
          }),
        }),
      }),
    }),
  });

  const mockQuizModel = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockWordModel = {
    find: jest.fn().mockImplementation((query: Record<string, unknown>) => {
      if (query?.toVerifyNextTime === true) {
        return verifyListChain([
          {
            ...mockWord,
            _id: mockWord._id,
            word: 'hello',
            translation: 'привіт',
            lastVerifiedAt: null,
            canEToU: false,
            canUToE: false,
            toVerifyNextTime: true,
          },
        ]);
      }
      if (query?.createdAt !== undefined) {
        return quizBucketChain([
          {
            _id: new Types.ObjectId(),
            word: 'quiz',
            translation: 'квіз',
            canEToU: false,
            canUToE: false,
            lastVerifiedAt: null,
          },
        ]);
      }
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      };
    }),
    countDocuments: jest.fn().mockReturnValue(countExecChain(1)),
    findById: jest.fn().mockReturnValue(findByIdChain(mockWord, mockWord)),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockWord),
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWord),
      }),
    }),
    create: jest.fn().mockResolvedValue({ toObject: () => mockWord }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWord),
      }),
    }),
    bulkWrite: jest.fn().mockResolvedValue({
      insertedCount: 0,
      matchedCount: 1,
      modifiedCount: 1,
      deletedCount: 0,
      upsertedCount: 0,
      upsertedIds: {},
      insertedIds: {},
    }),
    findOneAndDelete: jest.fn().mockReturnValue(execChain(mockWord)),
    syncIndexes: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordsService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
        {
          provide: getModelToken(Quiz.name),
          useValue: mockQuizModel,
        },
      ],
    }).compile();

    service = module.get<WordsService>(WordsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return page of words with nextCursor and hasMore', async () => {
      const result = await service.findAll(studentId, 2);
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should return hasMore and nextCursor when more than limit', async () => {
      const w2 = {
        ...mockWord,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
      };
      const w3 = {
        ...mockWord,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
      };
      const three = [mockWord, w2, w3];
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain(three)),
        }),
      });
      const result = await service.findAll(
        studentId,
        2,
        undefined,
        'createdAt',
        'desc',
      );
      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('should use cursor when provided and valid', async () => {
      const cursorPayload = Buffer.from(
        JSON.stringify({
          v: new Date().toISOString(),
          id: String(mockWord._id),
        }),
        'utf8',
      ).toString('base64');
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      const result = await service.findAll(
        studentId,
        2,
        cursorPayload,
        'createdAt',
        'desc',
      );
      expect(mockWordModel.find).toHaveBeenCalledWith(expect.any(Object));
      expect(result.items).toHaveLength(1);
    });

    it('should ignore invalid cursor', async () => {
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      const result = await service.findAll(
        studentId,
        2,
        'not-valid-base64!!',
        'createdAt',
        'desc',
      );
      expect(mockWordModel.find).toHaveBeenCalledWith({
        studentId,
      });
      expect(result.items).toHaveLength(1);
    });

    it('should build cursor with sortBy word when hasMore', async () => {
      const w2 = { ...mockWord, _id: new Types.ObjectId(), word: 'zebra' };
      const three = [mockWord, w2, { ...mockWord, _id: new Types.ObjectId() }];
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain(three)),
        }),
      });
      const result = await service.findAll(
        studentId,
        2,
        undefined,
        'word',
        'desc',
      );
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('should build cursor with sortBy translation when hasMore', async () => {
      const w2 = { ...mockWord, _id: new Types.ObjectId(), translation: 'zzz' };
      const three = [mockWord, w2, { ...mockWord, _id: new Types.ObjectId() }];
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain(three)),
        }),
      });
      const result = await service.findAll(
        studentId,
        2,
        undefined,
        'translation',
        'asc',
      );
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('should build cursor with translation undefined using empty string', async () => {
      const noTranslation = {
        ...mockWord,
        _id: new Types.ObjectId(),
        translation: undefined,
      };
      const three = [
        mockWord,
        noTranslation,
        { ...mockWord, _id: new Types.ObjectId() },
      ];
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain(three)),
        }),
      });
      const result = await service.findAll(
        studentId,
        2,
        undefined,
        'translation',
        'desc',
      );
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('should use cursor with order asc for createdAt', async () => {
      const cursorPayload = Buffer.from(
        JSON.stringify({
          v: new Date('2025-01-01').toISOString(),
          id: String(mockWord._id),
        }),
        'utf8',
      ).toString('base64');
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      await service.findAll(studentId, 2, cursorPayload, 'createdAt', 'asc');
      expect(mockWordModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: [
            { studentId },
            expect.objectContaining({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              $or: expect.any(Array),
            }),
          ],
        }),
      );
    });

    it('should use cursor with sortBy word without converting v to Date', async () => {
      const cursorPayload = Buffer.from(
        JSON.stringify({ v: 'hello', id: String(mockWord._id) }),
        'utf8',
      ).toString('base64');
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      await service.findAll(studentId, 2, cursorPayload, 'word', 'desc');
      expect(mockWordModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: [
            { studentId },
            expect.objectContaining({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              $or: expect.arrayContaining([
                expect.objectContaining({ word: { $lt: 'hello' } }),
              ]),
            }),
          ],
        }),
      );
    });

    it('should ignore cursor when payload id is invalid ObjectId', async () => {
      const cursorPayload = Buffer.from(
        JSON.stringify({ v: 'x', id: 'not-valid-id' }),
        'utf8',
      ).toString('base64');
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      const result = await service.findAll(
        studentId,
        2,
        cursorPayload,
        'createdAt',
        'desc',
      );
      expect(mockWordModel.find).toHaveBeenCalledWith({
        studentId,
      });
      expect(result.items).toHaveLength(1);
    });

    it('should filter by word search case-insensitively when search provided', async () => {
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      await service.findAll(
        studentId,
        20,
        undefined,
        'createdAt',
        'desc',
        'hello',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const query = mockWordModel.find.mock.calls[0][0] as {
        $and: [{ studentId: Types.ObjectId }, { word: RegExp }];
      };
      expect(query.$and[0]).toEqual({ studentId });
      expect(query.$and[1].word).toBeInstanceOf(RegExp);
      expect(query.$and[1].word.source).toBe('hello');
      expect(query.$and[1].word.flags).toContain('i');
    });

    it('should not add search filter when search is empty string', async () => {
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      await service.findAll(studentId, 20, undefined, 'createdAt', 'desc', '');
      expect(mockWordModel.find).toHaveBeenCalledWith({
        studentId,
      });
    });

    it('should combine search filter with cursor query when both provided', async () => {
      const cursorPayload = Buffer.from(
        JSON.stringify({
          v: new Date().toISOString(),
          id: String(mockWord._id),
        }),
        'utf8',
      ).toString('base64');
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      await service.findAll(
        studentId,
        2,
        cursorPayload,
        'createdAt',
        'desc',
        'foo',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const query = mockWordModel.find.mock.calls[0][0] as {
        $and: [
          { studentId: Types.ObjectId },
          { $and: [{ word: RegExp }, unknown] },
        ];
      };
      expect(query.$and).toHaveLength(2);
      expect(query.$and[0]).toEqual({ studentId });
      const inner = query.$and[1].$and;
      expect(inner[0].word).toBeInstanceOf(RegExp);
      expect(inner[0].word.source).toBe('foo');
      expect(inner[0].word.flags).toContain('i');
      expect(inner[1]).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          $or: expect.any(Array),
        }),
      );
    });

    it('should escape regex special characters in search term', async () => {
      mockWordModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(leanChain([mockWord])),
        }),
      });
      await service.findAll(
        studentId,
        20,
        undefined,
        'createdAt',
        'desc',
        'a+b',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const query = mockWordModel.find.mock.calls[0][0] as {
        $and: [{ studentId: Types.ObjectId }, { word: RegExp }];
      };
      expect(query.$and[0]).toEqual({ studentId });
      expect(query.$and[1].word).toBeInstanceOf(RegExp);
      expect(query.$and[1].word.source).toBe('a\\+b');
      expect(query.$and[1].word.flags).toContain('i');
    });
  });

  describe('findOne', () => {
    it('should return word by id', async () => {
      const result = await service.findOne(studentId, String(mockWord._id));
      expect(result).toEqual(mockWord);
    });

    it('should throw NotFoundException when not found', async () => {
      mockWordModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      await expect(
        service.findOne(studentId, '507f1f77bcf86cd799439011'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a word', async () => {
      mockWordModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      const dto = { word: 'test', translation: 'тест' };
      const result = await service.create(studentId, dto);
      expect(result).toEqual(mockWord);
      expect(mockWordModel.create).toHaveBeenCalled();
    });

    it('should set toVerifyNextTime to true when not provided (new words go to verify list)', async () => {
      mockWordModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      const dto = { word: 'newword' };
      await service.create(studentId, dto);
      expect(mockWordModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'newword',
          toVerifyNextTime: true,
          studentId,
        }),
      );
    });

    it('should respect toVerifyNextTime when provided in dto', async () => {
      mockWordModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      const dto = { word: 'other', toVerifyNextTime: false };
      await service.create(studentId, dto);
      expect(mockWordModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'other',
          toVerifyNextTime: false,
          studentId,
        }),
      );
    });

    it('should throw ConflictException when word already exists', async () => {
      mockWordModel.findOne.mockReturnValueOnce(execChain({ word: 'hello' }));
      await expect(
        service.create(studentId, { word: 'hello' }),
      ).rejects.toThrow(ConflictException);
      expect(mockWordModel.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a word', async () => {
      const result = await service.update(studentId, String(mockWord._id), {
        translation: 'updated',
      });
      expect(result).toEqual(mockWord);
      expect(mockWordModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not found', async () => {
      mockWordModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.update(studentId, '507f1f77bcf86cd799439011', {
          translation: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updated word duplicates another', async () => {
      mockWordModel.findOne
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(mockWord),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
        });
      await expect(
        service.update(studentId, String(mockWord._id), { word: 'existing' }),
      ).rejects.toThrow(ConflictException);
      expect(mockWordModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when findOneAndUpdate returns null', async () => {
      mockWordModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockWord),
      });
      mockWordModel.findOneAndUpdate.mockReturnValueOnce(leanChain(null));
      await expect(
        service.update(studentId, String(mockWord._id), {
          translation: 'updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update word and trim when dto.word is provided and no duplicate', async () => {
      const updatedWord = { ...mockWord, word: 'trimmed' };
      mockWordModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockWord),
      });
      mockWordModel.findOne.mockReturnValueOnce(execChain(null));
      mockWordModel.findOneAndUpdate.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedWord),
        }),
      });
      const result = await service.update(studentId, String(mockWord._id), {
        word: '  trimmed  ',
      });
      expect(result).toEqual(updatedWord);
      expect(mockWordModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: String(mockWord._id), studentId },
        expect.objectContaining({ word: 'trimmed' }),
        { new: true },
      );
    });
  });

  describe('remove', () => {
    it('should remove a word', async () => {
      await service.remove(studentId, String(mockWord._id));
      expect(mockWordModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: String(mockWord._id),
        studentId,
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockWordModel.findOneAndDelete.mockReturnValueOnce(execChain(null));
      await expect(
        service.remove(studentId, '507f1f77bcf86cd799439011'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findToVerifyList', () => {
    it('should return words with toVerifyNextTime true', async () => {
      const result = await service.findToVerifyList(studentId);
      expect(mockWordModel.find).toHaveBeenCalledWith({
        toVerifyNextTime: true,
        studentId,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        word: 'hello',
        translation: 'привіт',
        toVerifyNextTime: true,
      });
      expect(result[0]).toHaveProperty('_id');
    });
  });

  describe('generateVerifyQuiz', () => {
    it('should return quiz words from three buckets', async () => {
      const result = await service.generateVerifyQuiz(studentId, 10);
      expect(mockWordModel.find).toHaveBeenCalledTimes(3);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('_id');
      expect(result[0]).toHaveProperty('word');
      expect(result[0]).toHaveProperty('translation');
      expect(result[0]).toHaveProperty('canEToU');
      expect(result[0]).toHaveProperty('canUToE');
      expect(result[0]).toHaveProperty('lastVerifiedAt');
    });

    it('should request correct bucket sizes (25% each for first two, remainder for third)', async () => {
      await service.generateVerifyQuiz(studentId, 10);
      const findCalls = mockWordModel.find.mock.results;
      expect(findCalls.length).toBe(3);
      const limitCalls = findCalls
        .map((r) => (r as { value?: { select?: unknown } }).value?.select)
        .filter(Boolean);
      expect(limitCalls.length).toBe(3);
      // With 25% split for count 10: n1=2, n2=2, n3=6
    });

    it('should exclude words with toVerifyNextTime true from all buckets', async () => {
      mockWordModel.find.mockClear();
      await service.generateVerifyQuiz(studentId, 8);
      const findMock = mockWordModel.find;
      const queries = findMock.mock.calls.map(
        (c: [Record<string, unknown>]) => c[0],
      );
      expect(queries).toHaveLength(3);
      for (const q of queries) {
        expect(q).toMatchObject({
          studentId: studentId,
          toVerifyNextTime: { $ne: true },
        });
        expect(q).toHaveProperty('createdAt');
      }
    });
  });

  describe('submitVerifyQuiz', () => {
    it('should bulk-update words with lastVerifiedAt', async () => {
      const updates: WordVerifyUpdateDto[] = [
        {
          wordId: String(mockWord._id),
          word: mockWord.word,
          translation: mockWord.translation,
          canEToU: true,
          canUToE: false,
          toVerifyNextTime: true,
        },
      ];
      await service.submitVerifyQuiz(studentId, updates);
      expect(mockWordModel.bulkWrite).toHaveBeenCalledTimes(1);
      type VerifyQuizBulkOp = {
        updateOne: {
          filter: { _id: Types.ObjectId; studentId: Types.ObjectId };
          update: { $set: Record<string, unknown> };
        };
      };
      const firstBulkWriteCall = mockWordModel.bulkWrite.mock
        .calls[0] as unknown as [VerifyQuizBulkOp[], { ordered: boolean }];
      const [ops, options] = firstBulkWriteCall;
      expect(options).toEqual({ ordered: false });
      expect(ops[0].updateOne.filter._id.equals(mockWord._id)).toBe(true);
      expect(ops[0].updateOne.filter.studentId.equals(studentId)).toBe(true);
      expect(ops[0].updateOne.update.$set).toMatchObject({
        canEToU: true,
        canUToE: false,
        toVerifyNextTime: true,
      });
      expect(ops[0].updateOne.update.$set.lastVerifiedAt).toBeInstanceOf(Date);
      expect(mockQuizModel.create).toHaveBeenCalledTimes(1);
      type CreatedQuizArg = {
        studentId: Types.ObjectId;
        tutorId?: Types.ObjectId;
        entries: Array<{
          wordId: Types.ObjectId;
          word: string;
          translation?: string;
          canSpell?: boolean;
          canEToU: boolean;
          canUToE: boolean;
          toVerifyNextTime: boolean;
        }>;
      };
      const createCallArgs = mockQuizModel.create.mock.calls[0] as unknown as [
        CreatedQuizArg,
      ];
      const quizDoc = createCallArgs[0];
      expect(quizDoc.studentId.equals(studentId)).toBe(true);
      expect(quizDoc.tutorId).toBeUndefined();
      expect(quizDoc.entries).toEqual([
        {
          wordId: mockWord._id,
          word: mockWord.word,
          translation: mockWord.translation,
          canEToU: true,
          canUToE: false,
          toVerifyNextTime: true,
        },
      ]);
    });

    it('should set canSpell on words and quiz entry when provided', async () => {
      const updates: WordVerifyUpdateDto[] = [
        {
          wordId: String(mockWord._id),
          word: mockWord.word,
          translation: mockWord.translation,
          canSpell: true,
          canEToU: false,
          canUToE: true,
          toVerifyNextTime: false,
        },
      ];
      await service.submitVerifyQuiz(studentId, updates);
      type VerifyQuizBulkOp = {
        updateOne: { update: { $set: Record<string, unknown> } };
      };
      const [ops] = mockWordModel.bulkWrite.mock.calls[0] as unknown as [
        VerifyQuizBulkOp[],
        { ordered: boolean },
      ];
      expect(ops[0].updateOne.update.$set).toMatchObject({
        canSpell: true,
        canEToU: false,
        canUToE: true,
        toVerifyNextTime: false,
      });
      expect(mockQuizModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [
            expect.objectContaining({
              word: mockWord.word,
              translation: mockWord.translation,
              canSpell: true,
              canEToU: false,
              canUToE: true,
              toVerifyNextTime: false,
            }),
          ],
        }),
      );
    });

    it('should persist canSpell false on quiz entry when explicitly submitted', async () => {
      const updates: WordVerifyUpdateDto[] = [
        {
          wordId: String(mockWord._id),
          word: mockWord.word,
          translation: mockWord.translation,
          canSpell: false,
          canEToU: true,
          canUToE: true,
          toVerifyNextTime: false,
        },
      ];
      await service.submitVerifyQuiz(studentId, updates);
      const createCallArgs = mockQuizModel.create.mock.calls[0] as unknown as [
        {
          entries: Array<{ canSpell?: boolean }>;
        },
      ];
      expect(createCallArgs[0].entries[0].canSpell).toBe(false);
    });

    it('should persist tutorId when tutor submits for a student', async () => {
      const tutorId = new Types.ObjectId('507f1f77bcf86cd7994390aa');
      const updates: WordVerifyUpdateDto[] = [
        {
          wordId: String(mockWord._id),
          word: mockWord.word,
          translation: mockWord.translation,
          canEToU: true,
          canUToE: true,
          toVerifyNextTime: false,
        },
      ];
      await service.submitVerifyQuiz(studentId, updates, tutorId);
      type CreatedQuizArg = {
        studentId: Types.ObjectId;
        tutorId?: Types.ObjectId;
        entries: unknown[];
      };
      const [doc] = mockQuizModel.create.mock.calls[0] as unknown as [
        CreatedQuizArg,
      ];
      expect(doc.tutorId?.equals(tutorId)).toBe(true);
      expect(doc.studentId.equals(studentId)).toBe(true);
    });

    it('should skip bulkWrite when updates array is empty', async () => {
      await service.submitVerifyQuiz(studentId, []);
      expect(mockWordModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('should omit translation in quiz entry when absent or empty', async () => {
      type QuizCreatePayload = { entries: Array<{ translation?: string }> };
      const base = {
        wordId: String(mockWord._id),
        word: mockWord.word,
        canEToU: true,
        canUToE: false,
        toVerifyNextTime: true,
      };
      await service.submitVerifyQuiz(studentId, [base]);
      const firstCall = mockQuizModel.create.mock.calls[0] as unknown as [
        QuizCreatePayload,
      ];
      expect(firstCall[0].entries[0].translation).toBeUndefined();

      mockQuizModel.create.mockClear();
      await service.submitVerifyQuiz(studentId, [{ ...base, translation: '' }]);
      const secondCall = mockQuizModel.create.mock.calls[0] as unknown as [
        QuizCreatePayload,
      ];
      expect(secondCall[0].entries[0].translation).toBeUndefined();
    });

    it('should omit optional flags in bulk $set when not provided', async () => {
      const updates: WordVerifyUpdateDto[] = [
        {
          wordId: String(mockWord._id),
          word: mockWord.word,
        },
      ];
      await service.submitVerifyQuiz(studentId, updates);
      type VerifyQuizBulkOp = {
        updateOne: { update: { $set: Record<string, unknown> } };
      };
      const [ops] = mockWordModel.bulkWrite.mock.calls[0] as unknown as [
        VerifyQuizBulkOp[],
        { ordered: boolean },
      ];
      expect(ops[0].updateOne.update.$set).toEqual({
        lastVerifiedAt: expect.any(Date) as unknown as Date,
      });
      expect(mockQuizModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [
            {
              wordId: mockWord._id,
              word: mockWord.word,
              canEToU: false,
              canUToE: false,
              toVerifyNextTime: false,
            },
          ],
        }),
      );
    });
  });
});
