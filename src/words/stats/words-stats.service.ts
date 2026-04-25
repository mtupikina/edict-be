import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';

import { Quiz, QuizDocument } from '../schemas/quiz.schema';
import { Word, WordDocument } from '../schemas/word.schema';
import {
  MasteryPoint,
  PartOfSpeechPoint,
  ProblematicWord,
  QuizFrequencyPoint,
  QuizResultsPoint,
  WordsOverTimePoint,
} from './words-stats.types';

export type {
  MasteryPoint,
  PartOfSpeechPoint,
  ProblematicWord,
  QuizFrequencyPoint,
  QuizResultsPoint,
  WordsOverTimePoint,
};

@Injectable()
export class WordsStatsService {
  constructor(
    @InjectModel(Quiz.name)
    private readonly quizModel: Model<QuizDocument>,
    @InjectModel(Word.name)
    private readonly wordModel: Model<WordDocument>,
  ) {}

  private buildMatch(
    studentId: Types.ObjectId,
    from?: Date,
    to?: Date,
  ): Record<string, unknown> {
    return {
      studentId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { $gte: from }),
              ...(to && { $lte: to }),
            },
          }
        : {}),
    };
  }

  async getQuizFrequency(
    studentId: Types.ObjectId,
    groupBy: 'week' | 'month',
    from?: Date,
    to?: Date,
  ): Promise<QuizFrequencyPoint[]> {
    const match = this.buildMatch(studentId, from, to);

    const dateFormat = groupBy === 'week' ? '%G-W%V' : '%Y-%m';

    const pipeline: PipelineStage[] = [
      { $match: match },
      // Step 1: collapse multiple quizzes on the same calendar day into one
      // row by grouping on (period, day). This ensures a day with 3 quizzes
      // still counts as 1 quiz-day in the chart.
      {
        $group: {
          _id: {
            period: {
              $dateToString: { format: dateFormat, date: '$createdAt' },
            },
            day: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
          },
        },
      },
      // Step 2: count unique quiz-days per period.
      {
        $group: {
          _id: '$_id.period',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
      { $project: { _id: 0, period: '$_id', count: 1 } },
    ];

    return this.quizModel.aggregate<QuizFrequencyPoint>(pipeline).exec();
  }

  async getMasteryOverTime(
    studentId: Types.ObjectId,
    from?: Date,
    to?: Date,
  ): Promise<MasteryPoint[]> {
    const match = this.buildMatch(studentId, from, to);

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $unwind: '$entries' },
      {
        $group: {
          // ISO week (e.g. 2025-W14) — finer-grained than monthly so trends
          // are visible without smoothing out short streaks.
          _id: {
            $dateToString: { format: '%G-W%V', date: '$createdAt' },
          },
          canEToUCount: {
            $sum: { $cond: [{ $eq: ['$entries.canEToU', true] }, 1, 0] },
          },
          canUToECount: {
            $sum: { $cond: [{ $eq: ['$entries.canUToE', true] }, 1, 0] },
          },
          totalEntries: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
      {
        $project: {
          _id: 0,
          period: '$_id',
          canEToUCount: 1,
          canUToECount: 1,
          totalEntries: 1,
          canEToUPct: {
            $cond: [
              { $gt: ['$totalEntries', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$canEToUCount', '$totalEntries'] },
                      100,
                    ],
                  },
                  1,
                ],
              },
              0,
            ],
          },
          canUToEPct: {
            $cond: [
              { $gt: ['$totalEntries', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$canUToECount', '$totalEntries'] },
                      100,
                    ],
                  },
                  1,
                ],
              },
              0,
            ],
          },
        },
      },
    ];

    return this.quizModel.aggregate<MasteryPoint>(pipeline).exec();
  }

  async getWordsOverTime(
    studentId: Types.ObjectId,
    from?: Date,
    to?: Date,
  ): Promise<WordsOverTimePoint[]> {
    const match = this.buildMatch(studentId, from, to);

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          added: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
      { $project: { _id: 0, period: '$_id', added: 1 } },
    ];

    const rows = await this.wordModel
      .aggregate<{ period: string; added: number }>(pipeline)
      .exec();

    // Compute running total in JS — simpler and more reliable than $reduce in Mongo
    let cumulative = 0;
    return rows.map((r) => {
      cumulative += r.added;
      return { period: r.period, added: r.added, cumulative };
    });
  }

  async getPartsOfSpeech(
    studentId: Types.ObjectId,
    from?: Date,
    to?: Date,
  ): Promise<PartOfSpeechPoint[]> {
    const match = this.buildMatch(studentId, from, to);

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          // Normalise null/missing/empty-array/empty-string → 'unset' so they
          // are merged into one slice.  Strategy:
          //   1. $cond converts [] and '' → 'unset' (or keeps the string value)
          //   2. outer $ifNull converts BSON-null / missing → 'unset'
          _id: {
            $ifNull: [
              {
                $cond: [
                  {
                    $or: [
                      { $isArray: '$partOfSpeech' },
                      { $eq: ['$partOfSpeech', ''] },
                    ],
                  },
                  'unset',
                  '$partOfSpeech',
                ],
              },
              'unset',
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 as -1 } },
      { $project: { _id: 0, partOfSpeech: '$_id', count: 1 } },
    ];

    return this.wordModel.aggregate<PartOfSpeechPoint>(pipeline).exec();
  }

  async getQuizResults(
    studentId: Types.ObjectId,
    from?: Date,
    to?: Date,
  ): Promise<QuizResultsPoint[]> {
    const match = this.buildMatch(studentId, from, to);

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $unwind: '$entries' },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          knownCount: {
            $sum: {
              $cond: [{ $eq: ['$entries.toVerifyNextTime', false] }, 1, 0],
            },
          },
          reviewCount: {
            $sum: {
              $cond: [{ $eq: ['$entries.toVerifyNextTime', true] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
      {
        $project: {
          _id: 0,
          period: '$_id',
          knownCount: 1,
          reviewCount: 1,
          total: 1,
          knownPct: {
            $cond: [
              { $gt: ['$total', 0] },
              {
                $round: [
                  { $multiply: [{ $divide: ['$knownCount', '$total'] }, 100] },
                  1,
                ],
              },
              0,
            ],
          },
          reviewPct: {
            $cond: [
              { $gt: ['$total', 0] },
              {
                $round: [
                  { $multiply: [{ $divide: ['$reviewCount', '$total'] }, 100] },
                  1,
                ],
              },
              0,
            ],
          },
        },
      },
    ];

    return this.quizModel.aggregate<QuizResultsPoint>(pipeline).exec();
  }

  async getProblematicWords(
    studentId: Types.ObjectId,
    limit: number,
    from?: Date,
    to?: Date,
  ): Promise<ProblematicWord[]> {
    const match = this.buildMatch(studentId, from, to);

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $unwind: '$entries' },
      {
        $group: {
          _id: '$entries.wordId',
          word: { $first: '$entries.word' },
          translation: { $first: '$entries.translation' },
          reviewCount: {
            $sum: {
              $cond: [{ $eq: ['$entries.toVerifyNextTime', true] }, 1, 0],
            },
          },
          totalAppearances: { $sum: 1 },
        },
      },
      {
        $addFields: {
          reviewRate: {
            $cond: [
              { $gt: ['$totalAppearances', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$reviewCount', '$totalAppearances'] },
                      100,
                    ],
                  },
                  1,
                ],
              },
              0,
            ],
          },
        },
      },
      { $match: { reviewCount: { $gt: 0 } } },
      { $sort: { reviewCount: -1 as -1, reviewRate: -1 as -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          wordId: { $toString: '$_id' },
          word: 1,
          translation: 1,
          reviewCount: 1,
          totalAppearances: 1,
          reviewRate: 1,
        },
      },
    ];

    return this.quizModel.aggregate<ProblematicWord>(pipeline).exec();
  }
}
