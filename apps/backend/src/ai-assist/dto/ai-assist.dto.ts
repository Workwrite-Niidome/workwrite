import { IsString, IsOptional, IsObject, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

class ExistingCharacterDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class ExtractCharactersDto {
  @ApiProperty({ description: 'The generated text to analyze' })
  @IsString()
  generatedText: string;

  @ApiPropertyOptional({ description: 'Existing characters to exclude' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExistingCharacterDto)
  existingCharacters?: ExistingCharacterDto[];
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
