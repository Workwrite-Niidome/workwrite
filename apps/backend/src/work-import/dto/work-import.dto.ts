import { IsString, IsOptional, IsArray, ValidateNested, MaxLength } from 'class-validator';
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

export class ImportFileDto {
  @ApiPropertyOptional({ description: '既存作品に追加する場合のworkId' })
  @IsOptional()
  @IsString()
  workId?: string;

  @ApiPropertyOptional({ description: '新規作品のタイトル' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  synopsis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;
}

export class ImportMultipleFilesDto {
  @ApiPropertyOptional({ description: '既存作品に追加する場合のworkId' })
  @IsOptional()
  @IsString()
  workId?: string;

  @ApiPropertyOptional({ description: '新規作品のタイトル' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  synopsis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;
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

