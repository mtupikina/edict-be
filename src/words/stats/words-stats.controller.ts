import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import type { JwtPayload } from '../../auth/auth.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permissions } from '../../users/constants/permissions.constants';
import { WordsAccessService } from '../words-access.service';
import { WordsStatsService } from './words-stats.service';
import type {
  MasteryPoint,
  PartOfSpeechPoint,
  ProblematicWord,
  QuizFrequencyPoint,
  QuizResultsPoint,
  WordsOverTimePoint,
} from './words-stats.types';

/** Stats are accessible to anyone who can read words OR quiz results. */
const STATS_READ_PERMISSIONS = [Permissions.WORDS_READ, Permissions.TESTS_READ];

@Controller('words/stats')
@UseGuards(JwtAuthGuard)
export class WordsStatsController {
  constructor(
    private readonly statsService: WordsStatsService,
    private readonly wordsAccess: WordsAccessService,
  ) {}

  @Get('quiz-frequency')
  async getQuizFrequency(
    @CurrentUser() user: JwtPayload,
    @Query('groupBy') groupBy?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentId') studentId?: string,
  ): Promise<QuizFrequencyPoint[]> {
    const access = await this.wordsAccess.resolveAccess(
      user.email,
      studentId,
      STATS_READ_PERMISSIONS,
    );
    const parsedGroupBy: 'week' | 'month' =
      groupBy === 'week' ? 'week' : 'month';
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    return this.statsService.getQuizFrequency(
      access.effectiveStudentId,
      parsedGroupBy,
      parsedFrom,
      parsedTo,
    );
  }

  @Get('mastery-over-time')
  async getMasteryOverTime(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentId') studentId?: string,
  ): Promise<MasteryPoint[]> {
    const access = await this.wordsAccess.resolveAccess(
      user.email,
      studentId,
      STATS_READ_PERMISSIONS,
    );
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    return this.statsService.getMasteryOverTime(
      access.effectiveStudentId,
      parsedFrom,
      parsedTo,
    );
  }

  @Get('words-over-time')
  async getWordsOverTime(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentId') studentId?: string,
  ): Promise<WordsOverTimePoint[]> {
    const access = await this.wordsAccess.resolveAccess(
      user.email,
      studentId,
      STATS_READ_PERMISSIONS,
    );
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    return this.statsService.getWordsOverTime(
      access.effectiveStudentId,
      parsedFrom,
      parsedTo,
    );
  }

  @Get('parts-of-speech')
  async getPartsOfSpeech(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentId') studentId?: string,
  ): Promise<PartOfSpeechPoint[]> {
    const access = await this.wordsAccess.resolveAccess(
      user.email,
      studentId,
      STATS_READ_PERMISSIONS,
    );
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    return this.statsService.getPartsOfSpeech(
      access.effectiveStudentId,
      parsedFrom,
      parsedTo,
    );
  }

  @Get('quiz-results')
  async getQuizResults(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentId') studentId?: string,
  ): Promise<QuizResultsPoint[]> {
    const access = await this.wordsAccess.resolveAccess(
      user.email,
      studentId,
      STATS_READ_PERMISSIONS,
    );
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    return this.statsService.getQuizResults(
      access.effectiveStudentId,
      parsedFrom,
      parsedTo,
    );
  }

  @Get('problematic-words')
  async getProblematicWords(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentId') studentId?: string,
  ): Promise<ProblematicWord[]> {
    const access = await this.wordsAccess.resolveAccess(
      user.email,
      studentId,
      STATS_READ_PERMISSIONS,
    );
    const parsedLimit = limit
      ? Math.min(Math.max(1, parseInt(limit, 10)), 50)
      : 15;
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    return this.statsService.getProblematicWords(
      access.effectiveStudentId,
      parsedLimit,
      parsedFrom,
      parsedTo,
    );
  }
}
