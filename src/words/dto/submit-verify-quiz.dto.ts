import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WordVerifyUpdateDto {
  @IsMongoId()
  wordId: string;

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
