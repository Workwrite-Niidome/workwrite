import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiRecommendationsService } from './ai-recommendations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('AI Recommendations')
@Controller('ai')
export class AiRecommendationsController {
  constructor(private aiRecommendationsService: AiRecommendationsService) {}

  @Get('recommendations/for-me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized recommendations' })
  getForMe(@CurrentUser('id') userId: string) {
    return this.aiRecommendationsService.getPersonalRecommendations(userId);
  }

  @Get('recommendations/because-you-read/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get similar work recommendations' })
  getBecauseYouRead(@Param('workId') workId: string) {
    return this.aiRecommendationsService.getBecauseYouRead(workId);
  }

  @Post('embeddings/generate/:workId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate work embedding (admin only)' })
  generateEmbedding(@Param('workId') workId: string) {
    return this.aiRecommendationsService.generateEmbedding(workId);
  }
}
