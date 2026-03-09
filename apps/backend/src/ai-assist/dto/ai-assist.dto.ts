import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiAssistDto {
  @ApiProperty({ example: 'continue-writing' })
  @IsString()
  templateSlug: string;

  @ApiProperty({ example: { content: '朝日が昇るとき...' } })
  @IsObject()
  variables: Record<string, string>;

  @ApiPropertyOptional({ description: 'Use premium thinking mode (requires premium plan)' })
  @IsOptional()
  @IsBoolean()
  premiumMode?: boolean;
}

export class SaveDraftDto {
  @ApiProperty()
  @IsString()
  workId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  episodeId?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;
}
