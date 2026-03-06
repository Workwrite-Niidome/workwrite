import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum WorkStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  UNPUBLISHED = 'UNPUBLISHED',
}

export class UpdateWorkStatusDto {
  @ApiProperty({ enum: WorkStatusEnum })
  @IsEnum(WorkStatusEnum)
  status: WorkStatusEnum;
}
