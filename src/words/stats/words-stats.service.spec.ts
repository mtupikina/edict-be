import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { Quiz } from '../schemas/quiz.schema';
import { Word } from '../schemas/word.schema';
import { WordsStatsService } from './words-stats.service';

describe('WordsStatsService', () => {
  let service: WordsStatsService;

  const studentId = new Types.ObjectId('507f1f77bcf86cd799439099');

  /** Returns a mock aggregate chain with the given resolved result. */
  const aggChain = (result: unknown) => ({
    exec: jest.fn().mockResolvedValue(result),
  });

  const mockQuizModel = {
    aggregate: jest.fn(),
  };

  const mockWordModel = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordsStatsService,
        { provide: getModelToken(Quiz.name), useValue: mockQuizModel },
        { provide: getModelToken(Word.name), useValue: mockWordModel },
      ],
    }).compile();

    service = module.get<WordsStatsService>(WordsStatsService);
    jest.clearAllMocks();
  });

  // ── getQuizFrequency ─────────────────────────────────────────────────────

  describe('getQuizFrequency', () => {
    it('returns the aggregation result', async () => {
      const data = [{ period: '2025-01', count: 3 }];
      mockQuizModel.aggregate.mockReturnValue(aggChain(data));

      const result = await service.getQuizFrequency(studentId, 'month');
      expect(result).toEqual(data);
    });

    it('builds a pipeline with the month date format by default', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      await service.getQuizFrequency(studentId, 'month');

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const pipelineStr = JSON.stringify(pipeline);
      expect(pipelineStr).toContain('%Y-%m');
    });

    it('uses week format when groupBy is week', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      await service.getQuizFrequency(studentId, 'week');

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const pipelineStr = JSON.stringify(pipeline);
      expect(pipelineStr).toContain('%G-W%V');
    });

    it('adds createdAt filter when both from and to are provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      const to = new Date('2025-06-30');
      await service.getQuizFrequency(studentId, 'month', from, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toEqual({ $gte: from, $lte: to });
    });

    it('adds only $gte when only from is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      await service.getQuizFrequency(studentId, 'month', from);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toEqual(from);
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toBeUndefined();
    });

    it('adds only $lte when only to is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const to = new Date('2025-06-30');
      await service.getQuizFrequency(studentId, 'month', undefined, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toBeUndefined();
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toEqual(to);
    });

    it('omits createdAt filter when no dates are provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      await service.getQuizFrequency(studentId, 'month');

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toBeUndefined();
    });
  });

  // ── getMasteryOverTime ───────────────────────────────────────────────────

  describe('getMasteryOverTime', () => {
    it('returns the aggregation result', async () => {
      const data = [
        {
          period: '2025-01',
          canEToUPct: 75,
          canUToEPct: 60,
          canEToUCount: 3,
          canUToECount: 2,
          totalEntries: 4,
        },
      ];
      mockQuizModel.aggregate.mockReturnValue(aggChain(data));

      const result = await service.getMasteryOverTime(studentId);
      expect(result).toEqual(data);
    });

    it('adds date range when from and to are given', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      const to = new Date('2025-12-31');
      await service.getMasteryOverTime(studentId, from, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toEqual({ $gte: from, $lte: to });
    });

    it('adds only $gte when only from is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      await service.getMasteryOverTime(studentId, from);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toEqual(from);
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toBeUndefined();
    });

    it('adds only $lte when only to is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const to = new Date('2025-12-31');
      await service.getMasteryOverTime(studentId, undefined, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toBeUndefined();
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toEqual(to);
    });

    it('omits createdAt filter when no dates provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      await service.getMasteryOverTime(studentId);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toBeUndefined();
    });
  });

  // ── getWordsOverTime ─────────────────────────────────────────────────────

  describe('getWordsOverTime', () => {
    it('computes cumulative sum in JavaScript', async () => {
      mockWordModel.aggregate.mockReturnValue(
        aggChain([
          { period: '2025-01', added: 5 },
          { period: '2025-02', added: 3 },
          { period: '2025-03', added: 7 },
        ]),
      );

      const result = await service.getWordsOverTime(studentId);
      expect(result).toEqual([
        { period: '2025-01', added: 5, cumulative: 5 },
        { period: '2025-02', added: 3, cumulative: 8 },
        { period: '2025-03', added: 7, cumulative: 15 },
      ]);
    });

    it('returns an empty array when there are no words', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      const result = await service.getWordsOverTime(studentId);
      expect(result).toEqual([]);
    });

    it('adds date range when both from and to are given', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      const to = new Date('2025-06-30');
      await service.getWordsOverTime(studentId, from, to);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toEqual({ $gte: from, $lte: to });
    });

    it('adds only $gte when only from is provided', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      await service.getWordsOverTime(studentId, from);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toEqual(from);
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toBeUndefined();
    });

    it('adds only $lte when only to is provided', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      const to = new Date('2025-06-30');
      await service.getWordsOverTime(studentId, undefined, to);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toBeUndefined();
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toEqual(to);
    });

    it('omits createdAt filter when no dates are provided', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      await service.getWordsOverTime(studentId);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toBeUndefined();
    });
  });

  // ── getPartsOfSpeech ─────────────────────────────────────────────────────

  describe('getPartsOfSpeech', () => {
    it('returns the aggregation result', async () => {
      const data = [
        { partOfSpeech: 'noun', count: 10 },
        { partOfSpeech: 'verb', count: 6 },
      ];
      mockWordModel.aggregate.mockReturnValue(aggChain(data));

      const result = await service.getPartsOfSpeech(studentId);
      expect(result).toEqual(data);
    });

    it('adds date range when from and to are provided', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      const to = new Date('2025-06-30');
      await service.getPartsOfSpeech(studentId, from, to);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toEqual({ $gte: from, $lte: to });
    });

    it('adds only $gte when only from is provided', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      await service.getPartsOfSpeech(studentId, from);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toEqual(from);
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toBeUndefined();
    });

    it('adds only $lte when only to is provided', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      const to = new Date('2025-06-30');
      await service.getPartsOfSpeech(studentId, undefined, to);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toBeUndefined();
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toEqual(to);
    });

    it('omits createdAt filter when no dates are given', async () => {
      mockWordModel.aggregate.mockReturnValue(aggChain([]));
      await service.getPartsOfSpeech(studentId);

      const [pipeline] = mockWordModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toBeUndefined();
    });
  });

  // ── getQuizResults ───────────────────────────────────────────────────────

  describe('getQuizResults', () => {
    it('returns the aggregation result', async () => {
      const data = [
        {
          period: '2025-01-15',
          knownCount: 8,
          reviewCount: 2,
          knownPct: 80,
          reviewPct: 20,
          total: 10,
        },
      ];
      mockQuizModel.aggregate.mockReturnValue(aggChain(data));

      const result = await service.getQuizResults(studentId);
      expect(result).toEqual(data);
    });

    it('adds date range when from and to are provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      const to = new Date('2025-03-31');
      await service.getQuizResults(studentId, from, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toEqual({ $gte: from, $lte: to });
    });

    it('adds only $gte when only from is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      await service.getQuizResults(studentId, from);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toEqual(from);
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toBeUndefined();
    });

    it('adds only $lte when only to is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const to = new Date('2025-03-31');
      await service.getQuizResults(studentId, undefined, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toBeUndefined();
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toEqual(to);
    });

    it('omits createdAt filter when no dates are given', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      await service.getQuizResults(studentId);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toBeUndefined();
    });
  });

  // ── getProblematicWords ──────────────────────────────────────────────────

  describe('getProblematicWords', () => {
    it('returns the aggregation result', async () => {
      const data = [
        {
          wordId: 'abc',
          word: 'hello',
          translation: 'привіт',
          reviewCount: 5,
          totalAppearances: 10,
          reviewRate: 50,
        },
      ];
      mockQuizModel.aggregate.mockReturnValue(aggChain(data));

      const result = await service.getProblematicWords(studentId, 15);
      expect(result).toEqual(data);
    });

    it('includes a $limit stage equal to the limit argument', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      await service.getProblematicWords(studentId, 10);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const limitStage = (pipeline as { $limit?: number }[]).find(
        (s) => s.$limit !== undefined,
      );
      expect(limitStage?.$limit).toBe(10);
    });

    it('adds date range when from and to are provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      const to = new Date('2025-12-31');
      await service.getProblematicWords(studentId, 15, from, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toEqual({ $gte: from, $lte: to });
    });

    it('adds only $gte when only from is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const from = new Date('2025-01-01');
      await service.getProblematicWords(studentId, 15, from);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toEqual(from);
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toBeUndefined();
    });

    it('adds only $lte when only to is provided', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      const to = new Date('2025-12-31');
      await service.getProblematicWords(studentId, 15, undefined, to);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$gte'],
      ).toBeUndefined();
      expect(
        (matchStage['createdAt'] as Record<string, unknown>)['$lte'],
      ).toEqual(to);
    });

    it('omits createdAt filter when no dates are given', async () => {
      mockQuizModel.aggregate.mockReturnValue(aggChain([]));
      await service.getProblematicWords(studentId, 15);

      const [pipeline] = mockQuizModel.aggregate.mock.calls[0] as unknown[][];
      const matchStage = (pipeline as { $match?: Record<string, unknown> }[])[0]
        .$match!;
      expect(matchStage['createdAt']).toBeUndefined();
    });
  });
});
