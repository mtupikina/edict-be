import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

import {
  PART_OF_SPEECH_VALUES,
  type PartOfSpeech,
} from '../schemas/word.schema';

/**
 * Validated payload for **`POST /words/enrich`**: after the LLM returns JSON, it is
 * parsed and checked with `class-validator` into this shape before the controller
 * responds with `{ success: true, data }`.
 *
 * Only includes fields the model may produce. Tutor/quiz flags **`canSpell`**, **`canEToU`**,
 * **`canUToE`**, and **`toVerifyNextTime`** are not here—they are set when a tutor checks the
 * student (see verify quiz flow), not by enrichment.
 *
 * Aligned with {@link Word} content fields the AI may fill (excludes `studentId`,
 * `lastVerifiedAt`, `_id`, timestamps, and tutor-only flags above).
 */
export class AiEnrichedWordDto {
  @IsString()
  @IsNotEmpty({ message: 'Word is required' })
  @MinLength(1, { message: 'Word cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  word: string;

  @IsOptional()
  @IsString()
  translation?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(PART_OF_SPEECH_VALUES, {
    message:
      'Part of speech must be one of: ' + PART_OF_SPEECH_VALUES.join(', '),
  })
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value == null ? undefined : (value as PartOfSpeech),
  )
  partOfSpeech?: PartOfSpeech;

  @IsOptional()
  @IsString()
  transcription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antonyms?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examples?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  plural?: string;

  @IsOptional()
  @IsString()
  simplePast?: string;

  @IsOptional()
  @IsString()
  pastParticiple?: string;
}
