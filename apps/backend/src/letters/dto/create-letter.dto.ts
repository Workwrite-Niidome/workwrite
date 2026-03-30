import { IsString, IsEnum, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LetterTypeDto {
  SHORT = 'SHORT',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
  GIFT = 'GIFT',
}

export const LETTER_CONFIG = {
  SHORT: { price: 120, maxChars: 140, highlighted: false },
  STANDARD: { price: 300, maxChars: 500, highlighted: false },
  PREMIUM: { price: 500, maxChars: 1000, highlighted: true },
  GIFT: { price: 1000, maxChars: 1000, highlighted: true },
} as const;

export class CreateLetterDto {
  @ApiProperty()
  @IsString()
  episodeId: string;

  @ApiProperty({ enum: LetterTypeDto })
  @IsEnum(LetterTypeDto)
  type: LetterTypeDto;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  content: string;

  @ApiProperty({ required: false, description: 'GIFTタイプ時の金額（¥1,000〜）' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(100000)
  giftAmount?: number;
}
