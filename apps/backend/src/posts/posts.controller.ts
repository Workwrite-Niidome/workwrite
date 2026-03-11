import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostQueryDto } from './dto/post-query.dto';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ひとことを投稿する' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePostDto,
  ) {
    const post = await this.postsService.create(userId, dto);
    return { data: post };
  }

  @Get(':id')
  @ApiOperation({ summary: '投稿の詳細を取得' })
  async findById(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
  ) {
    const post = await this.postsService.findById(id, userId);
    return { data: post };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '投稿を削除する' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.postsService.delete(id, userId);
  }

  @Get(':id/replies')
  @ApiOperation({ summary: '投稿への返信一覧' })
  async getReplies(
    @Param('id') id: string,
    @Query() query: PostQueryDto,
    @CurrentUser('id') userId?: string,
  ) {
    const result = await this.postsService.getReplies(id, query.cursor, query.limit, userId);
    return { data: result };
  }

  // === Applause ===

  @Post(':id/applause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '拍手する' })
  async applaud(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.postsService.applaud(postId, userId);
  }

  @Delete(':id/applause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '拍手を取り消す' })
  async removeApplause(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.postsService.removeApplause(postId, userId);
  }

  // === Repost ===

  @Post(':id/repost')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'おすすめする（リポスト）' })
  async repost(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
  ) {
    const post = await this.postsService.repost(postId, userId);
    return { data: post };
  }

  @Delete(':id/repost')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'おすすめを取り消す' })
  async removeRepost(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.postsService.removeRepost(postId, userId);
  }

  // === Bookmark ===

  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'しおりに追加' })
  async bookmark(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.postsService.bookmark(postId, userId);
  }

  @Delete(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'しおりから削除' })
  async removeBookmark(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.postsService.removeBookmark(postId, userId);
  }

  @Get('/bookmarks/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'しおり一覧' })
  async getBookmarks(
    @CurrentUser('id') userId: string,
    @Query() query: PostQueryDto,
  ) {
    const result = await this.postsService.getBookmarks(userId, query.cursor, query.limit);
    return { data: result };
  }

  // === User posts ===

  @Get('/user/:userId')
  @ApiOperation({ summary: 'ユーザーの投稿一覧' })
  async getUserPosts(
    @Param('userId') userId: string,
    @Query() query: PostQueryDto,
    @CurrentUser('id') viewerId?: string,
  ) {
    const result = await this.postsService.getUserPosts(userId, query.cursor, query.limit, viewerId);
    return { data: result };
  }

  @Get('/user/:userId/applause')
  @ApiOperation({ summary: 'ユーザーが拍手した投稿一覧' })
  async getUserApplaudedPosts(
    @Param('userId') userId: string,
    @Query() query: PostQueryDto,
    @CurrentUser('id') viewerId?: string,
  ) {
    const result = await this.postsService.getUserApplaudedPosts(userId, query.cursor, query.limit, viewerId);
    return { data: result };
  }
}
