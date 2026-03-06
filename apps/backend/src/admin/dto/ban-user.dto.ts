import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BanUserDto {
  @ApiProperty()
  @IsBoolean()
  isBanned: boolean;
}
