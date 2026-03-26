import { IsString, IsOptional, IsEnum, IsBoolean, MaxLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus, CompletionStatus } from '@prisma/client';

export class CreateWorkDto {
  @ApiProperty({ example: '星降る夜のファンタジア' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: '満天の星空の下で始まる冒険譚...' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @ApiPropertyOptional({ description: '序章テキスト（読者に表示される導入文）' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  prologue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ example: 'fantasy' })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ type: [String], example: ['冒険', '感動'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'AI生成作品フラグ' })
  @IsOptional()
  @IsBoolean()
  isAiGenerated?: boolean;
}

export class UpdateWorkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @ApiPropertyOptional({ description: '序章テキスト' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  prologue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ enum: WorkStatus })
  @IsOptional()
  @IsEnum(WorkStatus)
  status?: WorkStatus;

  @ApiPropertyOptional({ enum: CompletionStatus })
  @IsOptional()
  @IsEnum(CompletionStatus)
  completionStatus?: CompletionStatus;

  @ApiPropertyOptional({ description: 'AI生成作品フラグ' })
  @IsOptional()
  @IsBoolean()
  isAiGenerated?: boolean;

  @ApiPropertyOptional({ description: 'キャラクタートーク有効/無効' })
  @IsOptional()
  @IsBoolean()
  enableCharacterTalk?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '公開時にスコアリングをスキップする' })
  @IsOptional()
  @IsBoolean()
  skipScoring?: boolean;
}
