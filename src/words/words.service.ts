import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';

import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { Word, WordDocument } from './schemas/word.schema';
import { WordVerifyUpdateDto } from './dto/submit-verify-quiz.dto';

/** Word fields for the to-verify list (route list). */
export interface ToVerifyWord extends Pick<
  Word,
  | 'word'
  | 'translation'
  | 'lastVerifiedAt'
  | 'canEToU'
  | 'canUToE'
  | 'toVerifyNextTime'
> {
  _id: string;
  /** Set by Mongoose timestamps. */
  createdAt?: Date;
}

/** Word fields for generated quiz. */
export interface QuizWord extends Pick<
  Word,
  'word' | 'translation' | 'canEToU' | 'canUToE' | 'lastVerifiedAt'
> {
  _id: string;
  /** Set by Mongoose timestamps. */
  createdAt?: Date;
}

export type WordsSortBy = 'word' | 'translation' | 'createdAt';
export type WordsOrder = 'asc' | 'desc';

export interface WordsPage {
  items: Word[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

interface CursorPayload {
  v: string | number; // sort field value (string or ISO date as string)
  id: string;
}

/** Controller-facing contract so the controller can depend on a resolved type. */
export interface WordsServiceContract {
  findToVerifyList(): Promise<ToVerifyWord[]>;
  generateVerifyQuiz(count: number): Promise<QuizWord[]>;
  submitVerifyQuiz(updates: WordVerifyUpdateDto[]): Promise<void>;
  findAll(
    limit?: number,
    cursor?: string,
    sortBy?: WordsSortBy,
    order?: WordsOrder,
    search?: string,
  ): Promise<WordsPage>;
  findOne(id: string): Promise<Word>;
  create(dto: CreateWordDto): Promise<Word>;
  update(id: string, dto: UpdateWordDto): Promise<Word>;
  remove(id: string): Promise<void>;
}

/** Escape special regex characters so user search is treated as literal. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class WordsService {
  constructor(
    @InjectModel(Word.name)
    private readonly wordModel: Model<WordDocument>,
  ) {}

  async findAll(
    limit = 20,
    cursor?: string,
    sortBy: WordsSortBy = 'createdAt',
    order: WordsOrder = 'desc',
    search?: string,
  ): Promise<WordsPage> {
    const sortDir = order === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir, _id: sortDir };

    const searchTerm = typeof search === 'string' ? search.trim() : undefined;
    const searchFilter =
      searchTerm !== undefined && searchTerm !== ''
        ? { word: new RegExp(escapeRegex(searchTerm), 'i') }
        : null;

    let query: Record<string, unknown> = {};
    if (cursor) {
      try {
        const payload = JSON.parse(
          Buffer.from(cursor, 'base64').toString('utf8'),
        ) as CursorPayload;
        const cursorId = Types.ObjectId.isValid(payload.id)
          ? new Types.ObjectId(payload.id)
          : null;
        if (cursorId) {
          let v: string | number | Date = payload.v;
          if (sortBy === 'createdAt' && typeof v === 'string') {
            v = new Date(v);
          }
          if (order === 'asc') {
            query = {
              $or: [
                { [sortBy]: { $gt: v } },
                { [sortBy]: v, _id: { $gt: cursorId } },
              ],
            };
          } else {
            query = {
              $or: [
                { [sortBy]: { $lt: v } },
                { [sortBy]: v, _id: { $lt: cursorId } },
              ],
            };
          }
        }
      } catch {
        // invalid cursor ignored
      }
    }

    if (searchFilter) {
      query =
        Object.keys(query).length > 0
          ? { $and: [searchFilter, query] }
          : searchFilter;
    }

    const countQuery = searchFilter ?? {};
    const [items, totalCount] = await Promise.all([
      this.wordModel
        .find(query)
        .sort(sort)
        .limit(limit + 1)
        .lean()
        .exec(),
      this.wordModel.countDocuments(countQuery).exec(),
    ]);

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const last = pageItems[pageItems.length - 1] as
      | (Word & { _id: Types.ObjectId })
      | undefined;
    let nextCursor: string | null = null;
    if (hasMore && last) {
      let sortValue: string | number = last._id.toString();
      const lastDoc = last as Word & { _id: Types.ObjectId; createdAt?: Date };
      if (sortBy === 'createdAt' && lastDoc.createdAt) {
        sortValue = new Date(lastDoc.createdAt).toISOString();
      } else if (sortBy === 'word' && lastDoc.word != null) {
        sortValue = lastDoc.word;
      } else if (sortBy === 'translation') {
        sortValue = lastDoc.translation ?? '';
      }
      nextCursor = Buffer.from(
        JSON.stringify({ v: sortValue, id: String(lastDoc._id) }),
        'utf8',
      ).toString('base64');
    }

    return {
      items: pageItems as Word[],
      nextCursor,
      hasMore,
      totalCount,
    };
  }

  async findOne(id: string): Promise<Word> {
    const word = await this.wordModel.findById(id).lean().exec();
    if (!word) {
      throw new NotFoundException(`Word with id ${id} not found`);
    }
    return word as Word;
  }

  async create(dto: CreateWordDto): Promise<Word> {
    const normalized = dto.word.trim().toLowerCase();
    const existing = await this.wordModel
      .findOne({ word: { $regex: new RegExp(`^${normalized}$`, 'i') } })
      .exec();
    if (existing) {
      throw new ConflictException(`Word "${dto.word}" already exists`);
    }
    const created = await this.wordModel.create({
      ...dto,
      word: dto.word.trim(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateWordDto): Promise<Word> {
    const existing = await this.wordModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Word with id ${id} not found`);
    }
    if (dto.word !== undefined) {
      const normalized = dto.word.trim().toLowerCase();
      const duplicate = await this.wordModel
        .findOne({
          word: { $regex: new RegExp(`^${normalized}$`, 'i') },
          _id: { $ne: id },
        })
        .exec();
      if (duplicate) {
        throw new ConflictException(`Word "${dto.word}" already exists`);
      }
    }
    const updated = await this.wordModel
      .findByIdAndUpdate(
        id,
        { ...dto, ...(dto.word !== undefined && { word: dto.word.trim() }) },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(`Word with id ${id} not found`);
    }
    return updated as Word;
  }

  async remove(id: string): Promise<void> {
    const result = await this.wordModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Word with id ${id} not found`);
    }
  }

  private static readonly VERIFY_LIST_PROJECTION = {
    word: 1,
    translation: 1,
    lastVerifiedAt: 1,
    canEToU: 1,
    canUToE: 1,
    toVerifyNextTime: 1,
    createdAt: 1,
  } as const;

  private static readonly QUIZ_WORD_PROJECTION = {
    word: 1,
    translation: 1,
    canEToU: 1,
    canUToE: 1,
    lastVerifiedAt: 1,
    createdAt: 1,
  } as const;

  async findToVerifyList(): Promise<ToVerifyWord[]> {
    const items = await this.wordModel
      .find({ toVerifyNextTime: true })
      .select(WordsService.VERIFY_LIST_PROJECTION)
      .sort({ word: 1 })
      .lean()
      .exec();
    return items.map((doc) => {
      const d = doc as Word & { _id: Types.ObjectId; createdAt?: Date };
      return {
        _id: String(d._id),
        word: d.word,
        translation: d.translation,
        lastVerifiedAt: d.lastVerifiedAt,
        canEToU: d.canEToU,
        canUToE: d.canUToE,
        toVerifyNextTime: d.toVerifyNextTime,
        createdAt: d.createdAt,
      };
    }) as ToVerifyWord[];
  }

  async generateVerifyQuiz(count: number): Promise<QuizWord[]> {
    const now = new Date();
    const hundredDaysAgo = new Date(now);
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    const oneYearAgo = new Date(now);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const n1 = Math.round(count * 0.25);
    const n2 = Math.round(count * 0.25);
    const n3 = count - n1 - n2;

    const sortByOldestVerified = {
      lastVerifiedAt: 1 as const,
      _id: 1 as const,
    };

    const [bucket1, bucket2, bucket3] = await Promise.all([
      n1 > 0
        ? this.wordModel
            .find({
              createdAt: { $gte: hundredDaysAgo },
            })
            .select(WordsService.QUIZ_WORD_PROJECTION)
            .sort(sortByOldestVerified)
            .limit(n1)
            .lean()
            .exec()
        : [],
      n2 > 0
        ? this.wordModel
            .find({
              createdAt: { $lt: hundredDaysAgo, $gte: oneYearAgo },
            })
            .select(WordsService.QUIZ_WORD_PROJECTION)
            .sort(sortByOldestVerified)
            .limit(n2)
            .lean()
            .exec()
        : [],
      n3 > 0
        ? this.wordModel
            .find({
              createdAt: { $lt: oneYearAgo },
            })
            .select(WordsService.QUIZ_WORD_PROJECTION)
            .sort(sortByOldestVerified)
            .limit(n3)
            .lean()
            .exec()
        : [],
    ]);

    const combined = [...bucket1, ...bucket2, ...bucket3];
    return combined.map((doc) => {
      const d = doc as Word & { _id: Types.ObjectId; createdAt?: Date };
      return {
        _id: String(d._id),
        word: d.word,
        translation: d.translation,
        canEToU: d.canEToU,
        canUToE: d.canUToE,
        lastVerifiedAt: d.lastVerifiedAt,
        createdAt: d.createdAt,
      };
    }) as QuizWord[];
  }

  async submitVerifyQuiz(updates: WordVerifyUpdateDto[]): Promise<void> {
    const now = new Date();
    await Promise.all(
      updates.map((u) =>
        this.wordModel
          .findByIdAndUpdate(u.wordId, {
            ...(u.canEToU !== undefined && { canEToU: u.canEToU }),
            ...(u.canUToE !== undefined && { canUToE: u.canUToE }),
            ...(u.toVerifyNextTime !== undefined && {
              toVerifyNextTime: u.toVerifyNextTime,
            }),
            lastVerifiedAt: now,
          })
          .exec(),
      ),
    );
  }
}
