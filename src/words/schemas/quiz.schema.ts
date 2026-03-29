import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type QuizDocument = Quiz & Document;

/** One word's submitted verification results in a quiz session. */
@Schema({ _id: false })
export class QuizWordEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  wordId: Types.ObjectId;

  @Prop({ required: true })
  word: string;

  @Prop()
  translation?: string;

  /** Omitted on the document when the client did not submit a spelling result. */
  @Prop({ type: Boolean })
  canSpell?: boolean;

  @Prop({ default: false })
  canEToU: boolean;

  @Prop({ default: false })
  canUToE: boolean;

  @Prop({ default: false })
  toVerifyNextTime: boolean;
}

export const QuizWordEntrySchema = SchemaFactory.createForClass(QuizWordEntry);

/** Persisted quiz submission: immutable record (createdAt only; no updatedAt). */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'quizes',
})
export class Quiz {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  studentId: Types.ObjectId;

  /** Set when the logged-in user submitted for another user’s vocabulary (e.g. tutor). */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    index: true,
  })
  tutorId?: Types.ObjectId;

  @Prop({ type: [QuizWordEntrySchema], default: [] })
  entries: QuizWordEntry[];
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
