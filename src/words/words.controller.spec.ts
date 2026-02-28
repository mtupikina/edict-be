import { Test, TestingModule } from '@nestjs/testing';

import { WordsController } from './words.controller';
import { WordsPage, WordsService } from './words.service';

describe('WordsController', () => {
  let controller: WordsController;

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordsController],
      providers: [{ provide: WordsService, useValue: mockWordsService }],
    }).compile();

    controller = module.get<WordsController>(WordsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated words', async () => {
      // module.get() loses generic return type; controller returns Promise<WordsPage>
      const result = (await controller.findAll(
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
        20,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass cursor to service', async () => {
      await controller.findAll('10', 'abc123');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        10,
        'abc123',
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass undefined cursor when cursor is empty string', async () => {
      await controller.findAll('10', '');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        10,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should clamp limit and pass sortBy and order', async () => {
      await controller.findAll('200', undefined, 'word', 'asc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        100,
        undefined,
        'word',
        'asc',
        undefined,
      );
    });

    it('should use default sortBy when invalid', async () => {
      await controller.findAll('5', undefined, 'invalid' as 'word', 'desc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        5,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should clamp limit to 1 when below minimum', async () => {
      await controller.findAll('0', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        1,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should use default limit 20 when limit string is empty', async () => {
      await controller.findAll('', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        20,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass order asc when provided', async () => {
      await controller.findAll('5', undefined, 'translation', 'asc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        5,
        undefined,
        'translation',
        'asc',
        undefined,
      );
    });

    it('should use default order when invalid', async () => {
      await controller.findAll('5', undefined, 'word', 'invalid' as 'asc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        5,
        undefined,
        'word',
        'desc',
        undefined,
      );
    });

    it('should use default limit 20 and createdAt when limit/sortBy omitted', async () => {
      await controller.findAll(undefined, undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        20,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass limit 1 when limit is 1', async () => {
      await controller.findAll('1', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        1,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass limit 100 when limit is 100', async () => {
      await controller.findAll('100', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        100,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should use default sortBy when sortBy is null', async () => {
      await controller.findAll(
        '10',
        undefined,
        null as unknown as string,
        undefined,
      );
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        10,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass sortBy createdAt when provided', async () => {
      await controller.findAll('10', undefined, 'createdAt', 'desc');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        10,
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass parsed limit when limit string given', async () => {
      await controller.findAll('abc', undefined);
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        expect.any(Number),
        undefined,
        'createdAt',
        'desc',
        undefined,
      );
    });

    it('should pass search to service when provided', async () => {
      await controller.findAll('20', undefined, 'createdAt', 'desc', 'hello');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
        20,
        undefined,
        'createdAt',
        'desc',
        'hello',
      );
    });

    it('should pass undefined search when search is empty or whitespace', async () => {
      await controller.findAll('20', undefined, undefined, undefined, '   ');
      expect(mockWordsService.findAll).toHaveBeenCalledWith(
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
      const result = await controller.findOne('1');
      expect(result).toEqual({ _id: '1', word: 'hello' });
      expect(mockWordsService.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('create', () => {
    it('should create a word', async () => {
      const dto = { word: 'test', translation: 'тест' };
      const result = await controller.create(dto);
      expect(result).toEqual({ _id: '1', word: 'hello' });
      expect(mockWordsService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update a word', async () => {
      const result = await controller.update('1', { translation: 'updated' });
      expect(result.translation).toBe('updated');
      expect(mockWordsService.update).toHaveBeenCalledWith('1', {
        translation: 'updated',
      });
    });
  });

  describe('remove', () => {
    it('should delete a word', async () => {
      const result = await controller.remove('1');
      expect(result).toEqual({ message: 'Word deleted successfully' });
      expect(mockWordsService.remove).toHaveBeenCalledWith('1');
    });
  });
});
