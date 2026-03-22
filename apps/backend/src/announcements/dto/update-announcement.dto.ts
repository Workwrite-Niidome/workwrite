import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

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
