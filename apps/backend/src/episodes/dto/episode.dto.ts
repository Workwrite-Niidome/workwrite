import { IsString, IsOptional, IsInt, IsBoolean, Min, MaxLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEpisodeDto {
  @ApiProperty({ example: '第一章 旅立ち' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: '朝日が昇るとき、少年は...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ description: 'Schedule publish time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Publish immediately (default false = draft)', default: false })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class UpdateEpisodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
