import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { Word } from './schemas/word.schema';
import { WordsPage, WordsService } from './words.service';

@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
  ): Promise<WordsPage> {
    const limitNum = limit
      ? Math.min(Math.max(1, parseInt(limit, 10)), 100)
      : 20;
    const validSortBy = ['word', 'translation', 'createdAt'].includes(
      sortBy ?? '',
    )
      ? (sortBy as 'word' | 'translation' | 'createdAt')
      : 'createdAt';
    const validOrder = order === 'asc' || order === 'desc' ? order : 'desc';
    return this.wordsService.findAll(
      limitNum,
      cursor || undefined,
      validSortBy,
      validOrder,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Word> {
    return this.wordsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateWordDto): Promise<Word> {
    return this.wordsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWordDto,
  ): Promise<Word> {
    return this.wordsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.wordsService.remove(id);
    return { message: 'Word deleted successfully' };
  }
}
