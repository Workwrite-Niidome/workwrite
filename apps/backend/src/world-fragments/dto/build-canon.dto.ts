import { IsOptional, IsNumber, IsArray, Min } from 'class-validator';

export class BuildCanonDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  upToEpisode?: number; // 省略時は全話

  @IsOptional()
  @IsArray()
  steps?: number[]; // 省略時は全ステップ (1, 2, 3)
}
