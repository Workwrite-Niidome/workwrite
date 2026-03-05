import { IsString, IsOptional, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportHistoryItemDto {
  @ApiProperty({ example: '吾輩は猫である' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: '夏目漱石' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;
}

export class ImportHistoryDto {
  @ApiProperty({ type: [ImportHistoryItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportHistoryItemDto)
  items: ImportHistoryItemDto[];
}
