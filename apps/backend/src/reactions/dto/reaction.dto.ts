import { IsInt, IsOptional, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VALID_EMOTIONS = ['moved', 'warm', 'surprised', 'fired_up', 'thoughtful'] as const;

export class CreateReactionDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  claps: number;

  @ApiPropertyOptional({ description: 'Emotion label', enum: VALID_EMOTIONS })
  @IsOptional()
  @IsIn(VALID_EMOTIONS)
  emotion?: string;
}
