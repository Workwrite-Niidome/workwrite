import { Controller, Get, Put, Param, Body, UseGuards, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiSettingsService } from './ai-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Admin AI Settings')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AiSettingsController {
  constructor(private aiSettings: AiSettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get all AI settings' })
  async getSettings() {
    return this.aiSettings.getAllSettings();
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Update AI setting' })
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: string; encrypted?: boolean },
    @CurrentUser('id') adminId: string,
  ) {
    await this.aiSettings.setSetting(key, body.value, body.encrypted ?? false, adminId);
    return { success: true };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get AI usage statistics' })
  async getUsage() {
    return this.aiSettings.getUsageStats();
  }

  @Get('usage/daily')
  @ApiOperation({ summary: 'Get daily AI usage' })
  async getDailyUsage(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.aiSettings.getDailyUsage(days);
  }
}
