import { IsString, MaxLength } from 'class-validator';

export class ExperienceDto {
  @IsString()
  @MaxLength(500)
  input: string;
}
