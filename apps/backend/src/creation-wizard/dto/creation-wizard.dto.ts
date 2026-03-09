import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateCharactersDto {
  @ApiProperty() @IsString() vision: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() genre?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() themes?: string;
}

export class GeneratePlotDto {
  @ApiProperty() @IsString() themes: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() message?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() emotionGoals?: string;
  @ApiProperty({ required: false }) @IsOptional() characters?: any;
}

export class GenerateEmotionBlueprintDto {
  @ApiProperty() @IsString() coreMessage: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() targetEmotions?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() readerJourney?: string;
}

export class GenerateChapterOutlineDto {
  @ApiProperty({ required: false }) @IsOptional() plotOutline?: any;
  @ApiProperty({ required: false }) @IsOptional() characters?: any;
  @ApiProperty({ required: false }) @IsOptional() emotionBlueprint?: any;
  @ApiProperty({ required: false }) @IsOptional() @IsString() additionalNotes?: string;
}

export class SaveCreationPlanDto {
  @ApiProperty({ required: false }) @IsOptional() @IsObject() characters?: any;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() plotOutline?: any;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() emotionBlueprint?: any;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() chapterOutline?: any;
}

export class AiFeedbackDto {
  @ApiProperty() @IsString() workId: string;
  @ApiProperty() @IsString() stage: string;
  @ApiProperty() @IsString() action: string;
  @ApiProperty() @IsNumber() inputChars: number;
  @ApiProperty() @IsNumber() outputChars: number;
  @ApiProperty({ default: 0 }) @IsNumber() acceptedChars: number;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() metadata?: any;
}
