import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { PART_OF_SPEECH_VALUES } from '../schemas/word.schema';

export class CreateWordDto {
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
    value === '' || value == null
      ? undefined
      : (value as (typeof PART_OF_SPEECH_VALUES)[number]),
  )
  partOfSpeech?: (typeof PART_OF_SPEECH_VALUES)[number];

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

  @IsOptional()
  @IsBoolean()
  canSpell?: boolean;

  @IsOptional()
  @IsBoolean()
  canEToU?: boolean;

  @IsOptional()
  @IsBoolean()
  canUToE?: boolean;

  @IsOptional()
  @IsBoolean()
  toVerifyNextTime?: boolean;

  @IsOptional()
  @IsDateString()
  lastVerifiedAt?: string;
}
