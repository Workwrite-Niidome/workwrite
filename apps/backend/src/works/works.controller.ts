import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorksService } from './works.service';
import { CreateWorkDto, UpdateWorkDto } from './dto/work.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Works')
@Controller('works')
export class WorksController {
  constructor(private worksService: WorksService) {}

  @Get()
  @ApiOperation({ summary: 'List published works' })
  findAll(@Query() query: PaginationDto & { genre?: string }) {
    return this.worksService.findAll(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my works (author)' })
  findMine(@CurrentUser('id') userId: string) {
    return this.worksService.findByAuthor(userId);
  }

  @Get('author/:userId')
  @ApiOperation({ summary: 'Get published works by author' })
  async findByAuthorPublic(@Param('userId') userId: string) {
    const works = await this.worksService.findPublishedByAuthor(userId);
    return { data: works };
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get work details' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.worksService.findOne(id, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new work' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWorkDto) {
    return this.worksService.create(userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update work' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateWorkDto,
  ) {
    return this.worksService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete work' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.worksService.delete(id, userId);
  }
}
