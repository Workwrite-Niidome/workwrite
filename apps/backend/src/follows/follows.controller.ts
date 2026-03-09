import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Follows')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':userId/follow')
  @ApiOperation({ summary: 'Follow a user' })
  follow(@CurrentUser('id') currentUserId: string, @Param('userId') userId: string) {
    return this.followsService.follow(currentUserId, userId);
  }

  @Delete(':userId/follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@CurrentUser('id') currentUserId: string, @Param('userId') userId: string) {
    return this.followsService.unfollow(currentUserId, userId);
  }

  @Get(':userId/follow/status')
  @ApiOperation({ summary: 'Check if following a user' })
  isFollowing(@CurrentUser('id') currentUserId: string, @Param('userId') userId: string) {
    return this.followsService.isFollowing(currentUserId, userId);
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get followers of a user' })
  getFollowers(@Param('userId') userId: string) {
    return this.followsService.getFollowers(userId);
  }

  @Get('me/following')
  @ApiOperation({ summary: 'Get users I follow' })
  getFollowing(@CurrentUser('id') userId: string) {
    return this.followsService.getFollowing(userId);
  }

  @Get('me/following/feed')
  @ApiOperation({ summary: 'Get feed from followed users' })
  getFollowingFeed(@CurrentUser('id') userId: string) {
    return this.followsService.getFollowingFeed(userId);
  }
}
