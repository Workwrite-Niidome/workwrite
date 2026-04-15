import { IsString, IsOptional } from 'class-validator';

export class AddWorkDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  synopsis?: string;

  @IsOptional()
  @IsString()
  genre?: string;
}
