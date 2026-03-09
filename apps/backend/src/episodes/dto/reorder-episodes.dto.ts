import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ReorderItem {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex: number;
}

export class ReorderEpisodesDto {
  @ApiProperty({ type: [ReorderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}
