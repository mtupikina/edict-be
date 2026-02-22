import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { WordsService } from './words.service';
import { Word } from './schemas/word.schema';

describe('WordsService', () => {
  let service: WordsService;

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

  const mockWordModel = {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue(leanChain([mockWord])),
      }),
    }),
    findById: jest.fn().mockReturnValue(findByIdChain(mockWord, mockWord)),
    findOne: jest.fn().mockReturnValue(execChain(null)),
    create: jest.fn().mockResolvedValue({ toObject: () => mockWord }),
    findByIdAndUpdate: jest.fn().mockReturnValue(leanChain(mockWord)),
    findByIdAndDelete: jest.fn().mockReturnValue(execChain(mockWord)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordsService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
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
      const result = await service.findAll(2);
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
      const result = await service.findAll(2, undefined, 'createdAt', 'desc');
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
        2,
        'not-valid-base64!!',
        'createdAt',
        'desc',
      );
      expect(mockWordModel.find).toHaveBeenCalledWith({});
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
      const result = await service.findAll(2, undefined, 'word', 'desc');
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
      const result = await service.findAll(2, undefined, 'translation', 'asc');
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
      const result = await service.findAll(2, undefined, 'translation', 'desc');
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
      await service.findAll(2, cursorPayload, 'createdAt', 'asc');
      expect(mockWordModel.find).toHaveBeenCalledWith(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect.objectContaining({ $or: expect.any(Array) }),
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
      await service.findAll(2, cursorPayload, 'word', 'desc');
      expect(mockWordModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          $or: expect.arrayContaining([
            expect.objectContaining({ word: { $lt: 'hello' } }),
          ]),
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
        2,
        cursorPayload,
        'createdAt',
        'desc',
      );
      expect(mockWordModel.find).toHaveBeenCalledWith({});
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return word by id', async () => {
      const result = await service.findOne(String(mockWord._id));
      expect(result).toEqual(mockWord);
    });

    it('should throw NotFoundException when not found', async () => {
      mockWordModel.findById.mockReturnValueOnce(findByIdChain(null, null));
      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a word', async () => {
      const dto = { word: 'test', translation: 'тест' };
      const result = await service.create(dto);
      expect(result).toEqual(mockWord);
      expect(mockWordModel.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when word already exists', async () => {
      mockWordModel.findOne.mockReturnValueOnce(execChain({ word: 'hello' }));
      await expect(service.create({ word: 'hello' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockWordModel.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a word', async () => {
      const result = await service.update(String(mockWord._id), {
        translation: 'updated',
      });
      expect(result).toEqual(mockWord);
      expect(mockWordModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not found', async () => {
      mockWordModel.findById.mockReturnValueOnce(findByIdChain(null, null));
      await expect(
        service.update('507f1f77bcf86cd799439011', { translation: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updated word duplicates another', async () => {
      mockWordModel.findById.mockReturnValueOnce(
        findByIdChain(mockWord, mockWord),
      );
      mockWordModel.findOne.mockReturnValueOnce(
        execChain({ _id: new Types.ObjectId() }),
      );
      await expect(
        service.update(String(mockWord._id), { word: 'existing' }),
      ).rejects.toThrow(ConflictException);
      expect(mockWordModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when findByIdAndUpdate returns null', async () => {
      mockWordModel.findById.mockReturnValueOnce(
        findByIdChain(mockWord, mockWord),
      );
      mockWordModel.findByIdAndUpdate.mockReturnValueOnce(leanChain(null));
      await expect(
        service.update(String(mockWord._id), { translation: 'updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update word and trim when dto.word is provided and no duplicate', async () => {
      const updatedWord = { ...mockWord, word: 'trimmed' };
      mockWordModel.findById.mockReturnValueOnce(
        findByIdChain(mockWord, mockWord),
      );
      mockWordModel.findOne.mockReturnValueOnce(execChain(null));
      mockWordModel.findByIdAndUpdate.mockReturnValueOnce(
        leanChain(updatedWord),
      );
      const result = await service.update(String(mockWord._id), {
        word: '  trimmed  ',
      });
      expect(result).toEqual(updatedWord);
      expect(mockWordModel.findByIdAndUpdate).toHaveBeenCalledWith(
        String(mockWord._id),
        expect.objectContaining({ word: 'trimmed' }),
        { new: true },
      );
    });
  });

  describe('remove', () => {
    it('should remove a word', async () => {
      await service.remove(String(mockWord._id));
      expect(mockWordModel.findByIdAndDelete).toHaveBeenCalledWith(
        String(mockWord._id),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      mockWordModel.findByIdAndDelete.mockReturnValueOnce(execChain(null));
      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
