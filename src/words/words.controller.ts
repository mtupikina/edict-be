import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';

import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiEnrichedWordDto } from './dto/ai-enriched-word.dto';
import { CreateWordDto } from './dto/create-word.dto';
import { EnrichWordDto } from './dto/enrich-word.dto';
import { GenerateVerifyQuizDto } from './dto/generate-verify-quiz.dto';
import { SubmitVerifyQuizDto } from './dto/submit-verify-quiz.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { Word } from './schemas/word.schema';
import type { WordsAccessContext } from './words-access-context';
import { WordsAccessService } from './words-access.service';
import { WordEnrichmentService } from './word-enrichment.service';
import type { WordEnrichSuccessResponse } from './word-enrichment.types';
import {
  QuizWord,
  ToVerifyWord,
  WordsPage,
  WordsService,
  type WordsServiceContract,
} from './words.service';

@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordsController {
  constructor(
    @Inject(WordsService)
    private readonly wordsService: WordsServiceContract,
    @Inject(WordsAccessService)
    private readonly wordsAccess: WordsAccessService,
    private readonly wordEnrichment: WordEnrichmentService,
  ) {}

  @Get('verify/list')
  async getToVerifyList(
    @CurrentUser() user: JwtPayload,
    @Query('studentId') studentId?: string,
  ): Promise<ToVerifyWord[]> {
    const access = await this.wordsAccess.resolveAccess(user.email, studentId);
    return await this.wordsService.findToVerifyList(access.effectiveStudentId);
  }

  @Post('verify/generate')
  async generateVerifyQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateVerifyQuizDto,
    @Query('studentId') studentId?: string,
  ): Promise<QuizWord[]> {
    const access = await this.wordsAccess.resolveAccess(user.email, studentId);
    const count = dto.count ?? 50;
    return await this.wordsService.generateVerifyQuiz(
      access.effectiveStudentId,
      count,
    );
  }

  @Post('verify/submit')
  async submitVerifyQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitVerifyQuizDto,
    @Query('studentId') studentId?: string,
  ): Promise<void> {
    const access: WordsAccessContext = await this.wordsAccess.resolveAccess(
      user.email,
      studentId,
    );
    if (access.isSelfReadOnly) {
      throw new ForbiddenException('Read-only access');
    }
    await this.wordsService.submitVerifyQuiz(
      access.effectiveStudentId,
      dto.updates,
      access.tutorId,
    );
  }

  @Post('enrich')
  async enrichWord(
    @CurrentUser() user: JwtPayload,
    @Body() dto: EnrichWordDto,
  ): Promise<WordEnrichSuccessResponse> {
    await this.wordsAccess.assertWordsWritePermission(user.email);
    const result = await this.wordEnrichment.enrich(dto.word);
    if (!result.ok) {
      throw new HttpException(
        {
          success: false,
          error: { code: result.code, message: result.message },
        },
        result.httpStatus,
      );
    }
    return {
      success: true,
      data: instanceToPlain(result.data) as AiEnrichedWordDto,
    };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
    @Query('search') search?: string,
    @Query('studentId') studentId?: string,
  ): Promise<WordsPage> {
    const access = await this.wordsAccess.resolveAccess(user.email, studentId);
    const limitNum = limit
      ? Math.min(Math.max(1, parseInt(limit, 10)), 100)
      : 20;
    const validSortBy = ['word', 'translation', 'createdAt'].includes(
      sortBy ?? '',
    )
      ? (sortBy as 'word' | 'translation' | 'createdAt')
      : 'createdAt';
    const validOrder = order === 'asc' || order === 'desc' ? order : 'desc';
    const searchParam =
      typeof search === 'string' ? search.trim() || undefined : undefined;
    return this.wordsService.findAll(
      access.effectiveStudentId,
      limitNum,
      cursor || undefined,
      validSortBy,
      validOrder,
      searchParam,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('studentId') studentId?: string,
  ): Promise<Word> {
    const access = await this.wordsAccess.resolveAccess(user.email, studentId);
    return this.wordsService.findOne(access.effectiveStudentId, id);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWordDto,
    @Query('studentId') studentId?: string,
  ): Promise<Word> {
    const access = await this.wordsAccess.resolveAccess(user.email, studentId);
    if (access.isSelfReadOnly) {
      throw new ForbiddenException('Read-only access');
    }
    return this.wordsService.create(access.effectiveStudentId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWordDto,
    @Query('studentId') studentId?: string,
  ): Promise<Word> {
    const access = await this.wordsAccess.resolveAccess(user.email, studentId);
    if (access.isSelfReadOnly) {
      throw new ForbiddenException('Read-only access');
    }
    return this.wordsService.update(access.effectiveStudentId, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('studentId') studentId?: string,
  ): Promise<{ message: string }> {
    const access = await this.wordsAccess.resolveAccess(user.email, studentId);
    if (access.isSelfReadOnly) {
      throw new ForbiddenException('Read-only access');
    }
    await this.wordsService.remove(access.effectiveStudentId, id);
    return { message: 'Word deleted successfully' };
  }
}
