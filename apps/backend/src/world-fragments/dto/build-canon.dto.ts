import { IsOptional, IsNumber, Min } from 'class-validator';

export class BuildCanonDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  upToEpisode?: number; // 省略時は全話
}
