import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromptTemplatesService } from './prompt-templates.service';
import { CreatePromptTemplateDto, UpdatePromptTemplateDto } from './dto/prompt-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Prompt Templates')
@Controller()
export class PromptTemplatesController {
  constructor(private templates: PromptTemplatesService) {}

  // Public (authenticated) - active templates only
  @Get('prompt-templates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active prompt templates' })
  findActive() {
    return this.templates.findActive();
  }

  // Admin - all templates
  @Get('admin/prompt-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all prompt templates (admin)' })
  findAll() {
    return this.templates.findAll();
  }

  @Post('admin/prompt-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create prompt template' })
  create(@Body() dto: CreatePromptTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch('admin/prompt-templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update prompt template' })
  update(@Param('id') id: string, @Body() dto: UpdatePromptTemplateDto) {
    return this.templates.update(id, dto);
  }

  @Delete('admin/prompt-templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete prompt template' })
  delete(@Param('id') id: string) {
    return this.templates.delete(id);
  }

  @Post('admin/prompt-templates/seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seed built-in templates' })
  seed() {
    return this.templates.seedBuiltInTemplates();
  }
}
