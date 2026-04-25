import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';

import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { Word, WordSchema } from './schemas/word.schema';
import { WordsStatsController } from './stats/words-stats.controller';
import { WordsStatsService } from './stats/words-stats.service';
import { WordsAccessService } from './words-access.service';
import { WordsController } from './words.controller';
import { WordsService } from './words.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
    UsersModule,
  ],
  controllers: [WordsController, WordsStatsController],
  providers: [WordsService, WordsAccessService, WordsStatsService],
  exports: [WordsService],
})
export class WordsModule {}
