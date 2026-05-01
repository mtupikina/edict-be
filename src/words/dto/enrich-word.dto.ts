import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class EnrichWordDto {
  @IsString()
  @IsNotEmpty({ message: 'Word is required' })
  @MinLength(1, { message: 'Word cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  word: string;
}
