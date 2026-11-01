import { IsArray, IsBoolean, IsMongoId } from 'class-validator';

export class SetKnownWellDto {
  @IsBoolean()
  knownWell: boolean;

  @IsArray()
  @IsMongoId({ each: true })
  wordIds: string[];
}
