import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class WordVerifyUpdateDto {
  @IsMongoId()
  wordId: string;

  /** English headword as shown in the quiz (stored on the quiz record; avoids a server round-trip). */
  @IsString()
  @IsNotEmpty({ message: 'Word is required for each quiz item' })
  @MinLength(1, { message: 'Word cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  word: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value == null
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  translation?: string;

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
}

export class SubmitVerifyQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordVerifyUpdateDto)
  updates: WordVerifyUpdateDto[];
}
