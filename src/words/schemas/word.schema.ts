import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WordDocument = Word & Document;

export const PART_OF_SPEECH_VALUES = [
  'adj',
  'adv',
  'conj',
  'interj',
  'n',
  'num',
  'ph',
  'ph v',
  'prep',
  'pron',
  'v',
] as const;
export type PartOfSpeech = (typeof PART_OF_SPEECH_VALUES)[number];

@Schema({ timestamps: true, collection: 'words' })
export class Word {
  @Prop({ type: [String], default: [] })
  antonyms: string[];

  @Prop({ default: false })
  canSpell: boolean;

  @Prop({ default: false })
  canEToU: boolean;

  @Prop({ default: false })
  canUToE: boolean;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  examples: string[];

  @Prop()
  lastVerifiedAt?: Date;

  @Prop({ type: String, enum: PART_OF_SPEECH_VALUES })
  partOfSpeech?: PartOfSpeech;

  @Prop()
  pastParticiple?: string;

  @Prop()
  plural?: string;

  @Prop()
  simplePast?: string;

  @Prop({ type: [String], default: [] })
  synonyms: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: false })
  toVerifyNextTime: boolean;

  @Prop()
  transcription?: string;

  @Prop()
  translation?: string;

  @Prop({ required: true, unique: true })
  word: string;
}

export const WordSchema = SchemaFactory.createForClass(Word);
