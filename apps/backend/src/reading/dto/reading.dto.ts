import { IsString, IsNumber, IsInt, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProgressEntryDto {
  @ApiProperty()
  @IsString()
  episodeId: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  progressPct: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  readTimeMs: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  lastPosition: number;
}

export class BatchProgressDto {
  @ApiProperty()
  @IsString()
  workId: string;

  @ApiProperty({ type: [ProgressEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgressEntryDto)
  entries: ProgressEntryDto[];
}
