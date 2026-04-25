import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import type { JwtPayload } from '../../auth/auth.service';
import { Permissions } from '../../users/constants/permissions.constants';
import { WordsAccessService } from '../words-access.service';
import { WordsStatsController } from './words-stats.controller';
import { WordsStatsService } from './words-stats.service';

describe('WordsStatsController', () => {
  let controller: WordsStatsController;

  const jwtUser: JwtPayload = { email: 'u@x.com', sub: 'sub-1' };
  const studentOid = new Types.ObjectId('507f1f77bcf86cd799439099');
  const accessCtx = { effectiveStudentId: studentOid, isSelfReadOnly: true };

  const mockWordsAccess = {
    resolveAccess: jest.fn().mockResolvedValue(accessCtx),
  };

  const mockStatsService = {
    getQuizFrequency: jest.fn().mockResolvedValue([]),
    getMasteryOverTime: jest.fn().mockResolvedValue([]),
    getWordsOverTime: jest.fn().mockResolvedValue([]),
    getPartsOfSpeech: jest.fn().mockResolvedValue([]),
    getQuizResults: jest.fn().mockResolvedValue([]),
    getProblematicWords: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordsStatsController],
      providers: [
        { provide: WordsAccessService, useValue: mockWordsAccess },
        { provide: WordsStatsService, useValue: mockStatsService },
      ],
    }).compile();

    controller = module.get<WordsStatsController>(WordsStatsController);
    jest.clearAllMocks();
    mockWordsAccess.resolveAccess.mockResolvedValue(accessCtx);
  });

  /** Confirms that every endpoint passes both read permissions to resolveAccess. */
  const expectStatsPermissions = () => {
    const calls = mockWordsAccess.resolveAccess.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe(jwtUser.email);
    expect(lastCall[2]).toEqual(
      expect.arrayContaining([Permissions.WORDS_READ, Permissions.TESTS_READ]),
    );
  };

  // ── getQuizFrequency ─────────────────────────────────────────────────────

  describe('getQuizFrequency', () => {
    it('passes STATS_READ_PERMISSIONS to resolveAccess', async () => {
      await controller.getQuizFrequency(jwtUser);
      expectStatsPermissions();
    });

    it('defaults groupBy to month when not provided', async () => {
      await controller.getQuizFrequency(jwtUser);
      expect(mockStatsService.getQuizFrequency).toHaveBeenCalledWith(
        studentOid,
        'month',
        undefined,
        undefined,
      );
    });

    it('uses week when groupBy=week', async () => {
      await controller.getQuizFrequency(jwtUser, 'week');
      expect(mockStatsService.getQuizFrequency).toHaveBeenCalledWith(
        studentOid,
        'week',
        undefined,
        undefined,
      );
    });

    it('parses from/to date strings', async () => {
      await controller.getQuizFrequency(
        jwtUser,
        'month',
        '2025-01-01',
        '2025-06-30',
      );
      const [, , from, to] = mockStatsService.getQuizFrequency.mock
        .calls[0] as [unknown, unknown, Date, Date];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });

    it('forwards studentId to resolveAccess', async () => {
      await controller.getQuizFrequency(
        jwtUser,
        undefined,
        undefined,
        undefined,
        studentOid.toString(),
      );
      expect(mockWordsAccess.resolveAccess).toHaveBeenCalledWith(
        jwtUser.email,
        studentOid.toString(),
        expect.any(Array),
      );
    });
  });

  // ── getMasteryOverTime ───────────────────────────────────────────────────

  describe('getMasteryOverTime', () => {
    it('passes STATS_READ_PERMISSIONS to resolveAccess', async () => {
      await controller.getMasteryOverTime(jwtUser);
      expectStatsPermissions();
    });

    it('calls statsService with parsed dates', async () => {
      await controller.getMasteryOverTime(jwtUser, '2025-01-01', '2025-03-31');
      const [, from, to] = mockStatsService.getMasteryOverTime.mock
        .calls[0] as [unknown, Date, Date];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── getWordsOverTime ─────────────────────────────────────────────────────

  describe('getWordsOverTime', () => {
    it('passes STATS_READ_PERMISSIONS to resolveAccess', async () => {
      await controller.getWordsOverTime(jwtUser);
      expectStatsPermissions();
    });

    it('passes undefined dates when not provided', async () => {
      await controller.getWordsOverTime(jwtUser);
      expect(mockStatsService.getWordsOverTime).toHaveBeenCalledWith(
        studentOid,
        undefined,
        undefined,
      );
    });

    it('parses from/to date strings', async () => {
      await controller.getWordsOverTime(jwtUser, '2025-01-01', '2025-06-30');
      const [, from, to] = mockStatsService.getWordsOverTime.mock.calls[0] as [
        unknown,
        Date,
        Date,
      ];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── getPartsOfSpeech ─────────────────────────────────────────────────────

  describe('getPartsOfSpeech', () => {
    it('passes STATS_READ_PERMISSIONS to resolveAccess', async () => {
      await controller.getPartsOfSpeech(jwtUser);
      expectStatsPermissions();
    });

    it('delegates to statsService', async () => {
      await controller.getPartsOfSpeech(jwtUser);
      expect(mockStatsService.getPartsOfSpeech).toHaveBeenCalledWith(
        studentOid,
        undefined,
        undefined,
      );
    });

    it('parses from/to date strings', async () => {
      await controller.getPartsOfSpeech(jwtUser, '2025-01-01', '2025-06-30');
      const [, from, to] = mockStatsService.getPartsOfSpeech.mock.calls[0] as [
        unknown,
        Date,
        Date,
      ];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── getQuizResults ───────────────────────────────────────────────────────

  describe('getQuizResults', () => {
    it('passes STATS_READ_PERMISSIONS to resolveAccess', async () => {
      await controller.getQuizResults(jwtUser);
      expectStatsPermissions();
    });

    it('parses from/to when provided', async () => {
      await controller.getQuizResults(jwtUser, '2025-04-01', '2025-04-30');
      const [, from, to] = mockStatsService.getQuizResults.mock.calls[0] as [
        unknown,
        Date,
        Date,
      ];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── getProblematicWords ──────────────────────────────────────────────────

  describe('getProblematicWords', () => {
    it('passes STATS_READ_PERMISSIONS to resolveAccess', async () => {
      await controller.getProblematicWords(jwtUser);
      expectStatsPermissions();
    });

    it('defaults limit to 15 when not provided', async () => {
      await controller.getProblematicWords(jwtUser);
      expect(mockStatsService.getProblematicWords).toHaveBeenCalledWith(
        studentOid,
        15,
        undefined,
        undefined,
      );
    });

    it('parses limit and clamps to 1–50', async () => {
      await controller.getProblematicWords(jwtUser, '200');
      const [, limit] = mockStatsService.getProblematicWords.mock.calls[0] as [
        unknown,
        number,
      ];
      expect(limit).toBe(50);
    });

    it('clamps limit to minimum of 1', async () => {
      await controller.getProblematicWords(jwtUser, '0');
      const [, limit] = mockStatsService.getProblematicWords.mock.calls[0] as [
        unknown,
        number,
      ];
      expect(limit).toBe(1);
    });

    it('parses limit within range', async () => {
      await controller.getProblematicWords(jwtUser, '20');
      const [, limit] = mockStatsService.getProblematicWords.mock.calls[0] as [
        unknown,
        number,
      ];
      expect(limit).toBe(20);
    });

    it('parses from/to date strings', async () => {
      await controller.getProblematicWords(
        jwtUser,
        undefined,
        '2025-01-01',
        '2025-06-30',
      );
      const [, , from, to] = mockStatsService.getProblematicWords.mock
        .calls[0] as [unknown, unknown, Date, Date];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });
});
