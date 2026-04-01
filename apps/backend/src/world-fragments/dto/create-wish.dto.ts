import { IsString, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

export enum WishTypeDto {
  PERSPECTIVE = 'PERSPECTIVE',
  SIDE_STORY = 'SIDE_STORY',
  MOMENT = 'MOMENT',
  WHAT_IF = 'WHAT_IF',
}

export class CreateWishDto {
  @IsString()
  wish: string;

  @IsEnum(WishTypeDto)
  wishType: WishTypeDto;

  @IsNumber()
  @Min(1)
  upToEpisode: number;

  @IsOptional()
  @IsString()
  anchorEpisodeId?: string;

  @IsOptional()
  @IsString()
  anchorEventId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  timelinePosition?: number;
}
