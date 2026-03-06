import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRoleEnum {
  READER = 'READER',
  AUTHOR = 'AUTHOR',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN',
}

export class UpdateRoleDto {
  @ApiProperty({ enum: UserRoleEnum })
  @IsEnum(UserRoleEnum)
  role: UserRoleEnum;
}
