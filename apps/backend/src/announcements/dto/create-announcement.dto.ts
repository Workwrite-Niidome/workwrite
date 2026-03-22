import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ['update', 'maintenance', 'feature', 'event'] })
  @IsOptional()
  @IsString()
  @IsIn(['update', 'maintenance', 'feature', 'event'])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyAll?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
