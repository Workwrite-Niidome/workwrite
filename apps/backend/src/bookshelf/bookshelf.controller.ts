import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookshelfStatus } from '@prisma/client';
import { BookshelfService } from './bookshelf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Bookshelf')
@Controller('reading/bookshelf')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookshelfController {
  constructor(private bookshelfService: BookshelfService) {}

  @Get()
  @ApiOperation({ summary: 'Get my bookshelf' })
  getBookshelf(
    @CurrentUser('id') userId: string,
    @Query('status') status?: BookshelfStatus,
  ) {
    return this.bookshelfService.getBookshelf(userId, status);
  }

  @Post()
  @ApiOperation({ summary: 'Add work to bookshelf' })
  add(@CurrentUser('id') userId: string, @Body('workId') workId: string) {
    return this.bookshelfService.addToBookshelf(userId, workId);
  }

  @Patch(':workId')
  @ApiOperation({ summary: 'Update bookshelf status' })
  update(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body('status') status: BookshelfStatus,
  ) {
    return this.bookshelfService.updateStatus(userId, workId, status);
  }

  @Delete(':workId')
  @ApiOperation({ summary: 'Remove from bookshelf' })
  remove(@CurrentUser('id') userId: string, @Param('workId') workId: string) {
    return this.bookshelfService.removeFromBookshelf(userId, workId);
  }
}
