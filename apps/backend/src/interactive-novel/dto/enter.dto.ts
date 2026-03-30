import { IsIn, IsString } from 'class-validator';

export class EnterDto {
  @IsString()
  @IsIn(['read', 'explore'])
  entryType: 'read' | 'explore';
}
