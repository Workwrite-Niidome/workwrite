import { IsString, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class TalkDto {
  @IsString()
  characterId: string;

  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsBoolean()
  useSonnet?: boolean;
}
