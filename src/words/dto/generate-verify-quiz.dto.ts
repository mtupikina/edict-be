import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateVerifyQuizDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Count must be at least 1' })
  @Max(100, { message: 'Count must be at most 100' })
  count?: number = 50;
}
