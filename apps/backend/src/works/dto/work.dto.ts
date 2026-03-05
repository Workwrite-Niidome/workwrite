import { IsString, IsOptional, IsEnum, MaxLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus } from '@prisma/client';

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
