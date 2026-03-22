import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReactionDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  claps: number;

  @ApiPropertyOptional({ description: 'Emotion label', enum: ['moved', 'warm', 'surprised', 'fired_up', 'thoughtful'] })
  @IsOptional()
  @IsString()
  emotion?: string;
}
