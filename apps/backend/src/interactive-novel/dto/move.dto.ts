import { IsString } from 'class-validator';

export class MoveDto {
  @IsString()
  locationId: string;
}
