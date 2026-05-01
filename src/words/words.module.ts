import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';

import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { Word, WordSchema } from './schemas/word.schema';
import { WordsStatsController } from './stats/words-stats.controller';
import { WordsStatsService } from './stats/words-stats.service';
import { WordsAccessService } from './words-access.service';
import { WordEnrichmentService } from './word-enrichment.service';
import { WordsController } from './words.controller';
import { WordsService } from './words.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
    HttpModule.register({
      timeout: 600_000,
      maxRedirects: 0,
    }),
    UsersModule,
  ],
  controllers: [WordsController, WordsStatsController],
  providers: [
    WordsService,
    WordsAccessService,
    WordsStatsService,
    WordEnrichmentService,
  ],
  exports: [WordsService],
})
export class WordsModule {}
