import { IsIn, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['standard', 'pro'])
  plan: 'standard' | 'pro';
}

export class GetTransactionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
