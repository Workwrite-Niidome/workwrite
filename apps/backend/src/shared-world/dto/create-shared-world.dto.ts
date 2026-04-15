import { IsString, IsOptional } from 'class-validator';

export class CreateSharedWorldDto {
  @IsString()
  canonWorkId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
