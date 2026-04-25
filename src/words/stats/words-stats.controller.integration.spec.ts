import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';

import type { JwtPayload } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WordsAccessService } from '../words-access.service';
import { WordsStatsController } from './words-stats.controller';
import { WordsStatsService } from './words-stats.service';

const studentOid = new Types.ObjectId('507f1f77bcf86cd799439099');

/**
 * Replaces JwtAuthGuard so HTTP integration tests do not need a real JWT.
 * Sets request.user so that @CurrentUser() has a value to extract.
 */
class MockJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    req.user = { email: 'u@x.com', sub: 'sub-1' };
    return true;
  }
}

describe('WordsStatsController (HTTP integration)', () => {
  let app: INestApplication<App>;

  const mockStatsService = {
    getQuizFrequency: jest.fn().mockResolvedValue([]),
    getMasteryOverTime: jest.fn().mockResolvedValue([]),
    getWordsOverTime: jest.fn().mockResolvedValue([]),
    getPartsOfSpeech: jest.fn().mockResolvedValue([]),
    getQuizResults: jest.fn().mockResolvedValue([]),
    getProblematicWords: jest.fn().mockResolvedValue([]),
  };

  const mockWordsAccess = {
    resolveAccess: jest.fn().mockResolvedValue({
      effectiveStudentId: studentOid,
      isSelfReadOnly: true,
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WordsStatsController],
      providers: [
        { provide: WordsStatsService, useValue: mockStatsService },
        { provide: WordsAccessService, useValue: mockWordsAccess },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ── GET /words/stats/quiz-frequency ──────────────────────────────────────

  describe('GET /words/stats/quiz-frequency', () => {
    it('returns 200 with no query params', () =>
      request(app.getHttpServer())
        .get('/words/stats/quiz-frequency')
        .expect(200)
        .expect([]));

    it('forwards groupBy=week to the service', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/quiz-frequency?groupBy=week')
        .expect(200);
      expect(mockStatsService.getQuizFrequency).toHaveBeenCalledWith(
        expect.anything(),
        'week',
        undefined,
        undefined,
      );
    });

    it('parses from/to query params into Date objects', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/quiz-frequency?from=2025-01-01&to=2025-06-30')
        .expect(200);
      const [, , from, to] = mockStatsService.getQuizFrequency.mock
        .calls[0] as [unknown, unknown, Date, Date];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── GET /words/stats/mastery-over-time ───────────────────────────────────

  describe('GET /words/stats/mastery-over-time', () => {
    it('returns 200 with no query params', () =>
      request(app.getHttpServer())
        .get('/words/stats/mastery-over-time')
        .expect(200)
        .expect([]));

    it('parses from/to query params into Date objects', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/mastery-over-time?from=2025-01-01&to=2025-06-30')
        .expect(200);
      const [, from, to] = mockStatsService.getMasteryOverTime.mock
        .calls[0] as [unknown, Date, Date];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── GET /words/stats/words-over-time ─────────────────────────────────────

  describe('GET /words/stats/words-over-time', () => {
    it('returns 200 with no query params', () =>
      request(app.getHttpServer())
        .get('/words/stats/words-over-time')
        .expect(200)
        .expect([]));

    it('parses from/to query params into Date objects', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/words-over-time?from=2025-01-01&to=2025-06-30')
        .expect(200);
      const [, from, to] = mockStatsService.getWordsOverTime.mock.calls[0] as [
        unknown,
        Date,
        Date,
      ];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── GET /words/stats/parts-of-speech ─────────────────────────────────────

  describe('GET /words/stats/parts-of-speech', () => {
    it('returns 200 with no query params', () =>
      request(app.getHttpServer())
        .get('/words/stats/parts-of-speech')
        .expect(200)
        .expect([]));

    it('parses from/to query params into Date objects', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/parts-of-speech?from=2025-01-01&to=2025-06-30')
        .expect(200);
      const [, from, to] = mockStatsService.getPartsOfSpeech.mock.calls[0] as [
        unknown,
        Date,
        Date,
      ];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── GET /words/stats/quiz-results ────────────────────────────────────────

  describe('GET /words/stats/quiz-results', () => {
    it('returns 200 with no query params', () =>
      request(app.getHttpServer())
        .get('/words/stats/quiz-results')
        .expect(200)
        .expect([]));

    it('parses from/to query params into Date objects', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/quiz-results?from=2025-01-01&to=2025-06-30')
        .expect(200);
      const [, from, to] = mockStatsService.getQuizResults.mock.calls[0] as [
        unknown,
        Date,
        Date,
      ];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── GET /words/stats/problematic-words ───────────────────────────────────

  describe('GET /words/stats/problematic-words', () => {
    it('returns 200 with no query params', () =>
      request(app.getHttpServer())
        .get('/words/stats/problematic-words')
        .expect(200)
        .expect([]));

    it('forwards limit query param to the service', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/problematic-words?limit=20')
        .expect(200);
      const [, limit] = mockStatsService.getProblematicWords.mock.calls[0] as [
        unknown,
        number,
      ];
      expect(limit).toBe(20);
    });

    it('parses from/to query params into Date objects', async () => {
      await request(app.getHttpServer())
        .get('/words/stats/problematic-words?from=2025-01-01&to=2025-06-30')
        .expect(200);
      const [, , from, to] = mockStatsService.getProblematicWords.mock
        .calls[0] as [unknown, unknown, Date, Date];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
    });
  });

  // ── Guard: unauthenticated request is rejected ────────────────────────────

  it('returns 401 when the guard rejects', async () => {
    const blockedModule = await Test.createTestingModule({
      controllers: [WordsStatsController],
      providers: [
        { provide: WordsStatsService, useValue: mockStatsService },
        { provide: WordsAccessService, useValue: mockWordsAccess },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => false })
      .compile();

    const blockedApp = blockedModule.createNestApplication();
    await blockedApp.init();

    await request(blockedApp.getHttpServer() as App)
      .get('/words/stats/quiz-frequency')
      .expect(403);

    await blockedApp.close();
  });
});
