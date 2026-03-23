import { IsString, IsInt, Min, Max } from 'class-validator';

export class CreateTipDto {
  @IsString()
  recipientId: string;

  @IsInt()
  @Min(100)
  @Max(100000)
  amount: number;
}
