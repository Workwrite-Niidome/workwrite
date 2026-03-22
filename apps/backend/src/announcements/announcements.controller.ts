import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// ── Admin endpoints ──

@ApiTags('Admin - Announcements')
@Controller('admin/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'List all announcements (admin)' })
  @ApiQuery({ name: 'isPublished', required: false })
  @ApiQuery({ name: 'category', required: false })
  async findAll(
    @Query('isPublished') isPublished?: string,
    @Query('category') category?: string,
  ) {
    const options: { isPublished?: boolean; category?: string } = {};
    if (isPublished === 'true') options.isPublished = true;
    if (isPublished === 'false') options.isPublished = false;
    if (category) options.category = category;
    const data = await this.announcementsService.findAll(options);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Create announcement' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    const data = await this.announcementsService.create(userId, dto);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update announcement' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    const data = await this.announcementsService.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete announcement' })
  async delete(@Param('id') id: string) {
    const data = await this.announcementsService.delete(id);
    return { data };
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish announcement (+ optional notify)' })
  async publish(@Param('id') id: string) {
    const data = await this.announcementsService.publish(id);
    return { data };
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish announcement' })
  async unpublish(@Param('id') id: string) {
    const data = await this.announcementsService.unpublish(id);
    return { data };
  }
}

// ── Public endpoints ──

@ApiTags('Announcements')
@Controller('announcements')
export class PublicAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'List published announcements' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  async findPublished(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const result = await this.announcementsService.findPublished(
      limit ? parseInt(limit, 10) : 20,
      cursor || undefined,
    );
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single published announcement' })
  async findOne(@Param('id') id: string) {
    const data = await this.announcementsService.findOne(id);
    return { data };
  }
}
