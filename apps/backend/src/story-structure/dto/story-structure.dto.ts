import { IsString, IsOptional, IsBoolean, IsInt, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Characters ──────────────────────────────────────────

export class CreateCharacterDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() role: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() age?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() personality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() speechStyle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstPerson?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() appearance?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() background?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() motivation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() arc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateCharacterDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() age?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() personality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() speechStyle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstPerson?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() appearance?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() background?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() motivation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() arc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class SetRelationDto {
  @ApiProperty() @IsString() toCharacterId: string;
  @ApiProperty() @IsString() relationType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

// ─── Story Arc ───────────────────────────────────────────

export class CreateSceneDto {
  @ApiProperty() @IsString() actId: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emotionTarget?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() intensity?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) characters?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateSceneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emotionTarget?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() intensity?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) characters?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() episodeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

class ActInput {
  @IsInt() actNumber: number;
  @IsString() title: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() turningPoint?: string;
}

export class UpsertArcDto {
  @ApiPropertyOptional() @IsOptional() @IsString() premise?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() centralConflict?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) themes?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActInput) acts?: ActInput[];
}
