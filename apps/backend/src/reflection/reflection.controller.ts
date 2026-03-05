import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReflectionService } from './reflection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reflection')
@Controller('reflection')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReflectionController {
  constructor(private reflectionService: ReflectionService) {}

  // State Changes
  @Post('state-change')
  @ApiOperation({ summary: 'Save state change for a work' })
  saveStateChange(
    @CurrentUser('id') userId: string,
    @Body() body: { workId: string; axis: string; before: number; after: number },
  ) {
    return this.reflectionService.saveStateChange(userId, body);
  }

  @Post('state-changes/batch')
  @ApiOperation({ summary: 'Save multiple state changes for a work' })
  saveMultipleStateChanges(
    @CurrentUser('id') userId: string,
    @Body() body: { workId: string; changes: { axis: string; before: number; after: number }[] },
  ) {
    return this.reflectionService.saveMultipleStateChanges(userId, body.workId, body.changes);
  }

  @Get('state-changes/:workId')
  @ApiOperation({ summary: 'Get state changes for a work' })
  getStateChanges(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.reflectionService.getStateChangesForWork(userId, workId);
  }

  // Timeline
  @Get('timeline')
  @ApiOperation({ summary: 'Get self-transformation timeline' })
  getTimeline(@CurrentUser('id') userId: string) {
    return this.reflectionService.getTimeline(userId);
  }

  // Points
  @Get('points')
  @ApiOperation({ summary: 'Get point balance' })
  getPoints(@CurrentUser('id') userId: string) {
    return this.reflectionService.getPoints(userId);
  }

  @Get('points/history')
  @ApiOperation({ summary: 'Get point transaction history' })
  getPointHistory(@CurrentUser('id') userId: string) {
    return this.reflectionService.getPointHistory(userId);
  }
}
