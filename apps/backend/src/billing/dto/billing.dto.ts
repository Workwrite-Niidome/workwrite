import { IsIn, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['standard', 'pro'])
  plan: 'standard' | 'pro';
}

export class PurchaseCreditsDto {
  @IsOptional()
  @IsIn(['free_500', 'free_1000'])
  tier?: 'free_500' | 'free_1000';
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
