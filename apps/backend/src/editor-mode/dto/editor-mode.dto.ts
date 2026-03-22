import { IsString, IsOptional, IsNumber, IsIn, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditorModeChatDto {
  @ApiProperty() @IsString() message: string;
  @ApiProperty({ required: false, enum: ['normal', 'premium'], default: 'normal' })
  @IsOptional()
  @IsIn(['normal', 'premium'])
  aiMode?: 'normal' | 'premium' = 'normal';
}

export class FinalizeDesignDto {
  @ApiProperty() @IsNumber() @Min(1) @Max(100) totalEpisodes: number;
  @ApiProperty() @IsNumber() @Min(500) @Max(20000) charCountPerEpisode: number;
  @ApiProperty({ required: false, enum: ['normal', 'premium'] })
  @IsOptional()
  @IsIn(['normal', 'premium'])
  aiMode?: 'normal' | 'premium';
}

export class StartGenerationDto {
  @ApiProperty({ enum: ['normal', 'premium'] })
  @IsIn(['normal', 'premium'])
  aiMode: 'normal' | 'premium';

  @ApiProperty({ enum: ['batch', 'confirm'] })
  @IsIn(['batch', 'confirm'])
  generationMode: 'batch' | 'confirm';
}

export class ReviseEpisodeDto {
  @ApiProperty() @IsString() @MaxLength(2000) instruction: string;
  @ApiProperty({ required: false, enum: ['normal', 'premium'] })
  @IsOptional()
  @IsIn(['normal', 'premium'])
  aiMode?: 'normal' | 'premium';
}

export class ChangeGenerationModeDto {
  @ApiProperty({ enum: ['batch', 'confirm'] })
  @IsIn(['batch', 'confirm'])
  generationMode: 'batch' | 'confirm';
}
