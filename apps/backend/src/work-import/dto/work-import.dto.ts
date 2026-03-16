import { IsString, IsOptional, IsArray, IsBoolean, IsUrl, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ChapterDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  content: string;
}

export class AnalyzeTextDto {
  @ApiProperty()
  @IsString()
  text: string;
}

export class ImportTextDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  synopsis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiProperty({ type: [ChapterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChapterDto)
  chapters: ChapterDto[];
}

export class ImportUrlDto {
  @ApiProperty({ description: 'なろう or カクヨムのURL' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ description: '自動スコアリングを実行するか（デフォルト: true）' })
  @IsOptional()
  @IsBoolean()
  autoScore?: boolean;
}
