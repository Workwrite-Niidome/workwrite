import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditorModeChatDto {
  @ApiProperty() @IsString() message: string;
  @ApiProperty({ required: false, enum: ['normal', 'premium'], default: 'normal' })
  @IsOptional()
  @IsIn(['normal', 'premium'])
  aiMode?: 'normal' | 'premium' = 'normal';
}

export class FinalizeDesignDto {
  @ApiProperty() @IsNumber() totalEpisodes: number;
  @ApiProperty() @IsNumber() charCountPerEpisode: number;
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
  @ApiProperty() @IsString() instruction: string;
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
