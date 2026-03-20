import {
  Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
import { CreditService } from '../billing/credit.service';
import { AiRecommendationsService } from '../ai-recommendations/ai-recommendations.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { UpdateWorkStatusDto } from './dto/update-work-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private adminService: AdminService,
    private aiTier: AiTierService,
    private creditService: CreditService,
    private aiRecommendations: AiRecommendationsService,
    private prisma: PrismaService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search, role });
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.adminService.updateUserRole(adminId, id, dto.role);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Ban or unban user' })
  banUser(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ) {
    return this.adminService.banUser(adminId, id, dto.isBanned);
  }

  @Get('works')
  @ApiOperation({ summary: 'List works (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getWorks(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getWorks({ page, limit, status });
  }

  @Patch('works/:id/status')
  @ApiOperation({ summary: 'Update work status' })
  updateWorkStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWorkStatusDto,
  ) {
    return this.adminService.updateWorkStatus(id, dto.status);
  }

  @Patch('works/:id/ai-generated')
  @ApiOperation({ summary: 'Toggle AI generated flag' })
  async updateAiGenerated(
    @Param('id') id: string,
    @Body() body: { isAiGenerated: boolean },
  ) {
    const work = await this.prisma.work.update({
      where: { id },
      data: { isAiGenerated: Boolean(body.isAiGenerated) },
    });
    return { data: { id: work.id, isAiGenerated: work.isAiGenerated } };
  }

  @Get('reviews')
  @ApiOperation({ summary: 'List reviews (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getReviews({ page, limit });
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete a review' })
  deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }

  // ─── Subscription Plan Management ─────────────────────────

  @Post('users/:id/plan')
  @ApiOperation({ summary: 'Grant subscription plan to user (standard/premium)' })
  async grantPlan(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body() body: { plan: 'standard' | 'pro' },
  ) {
    await this.aiTier.grantPlan(adminId, userId, body.plan);
    return { granted: true, userId, plan: body.plan };
  }

  @Delete('users/:id/plan')
  @ApiOperation({ summary: 'Revoke subscription plan from user' })
  async revokePlan(@Param('id') userId: string) {
    await this.aiTier.revokePlan(userId);
    return { revoked: true, userId };
  }

  @Get('users/:id/tier')
  @ApiOperation({ summary: 'Get user AI tier info' })
  async getUserTier(@Param('id') userId: string) {
    return this.aiTier.getUserTier(userId);
  }

  // ─── Credit Grant ────────────────────────────────────────

  @Post('users/:id/credits')
  @ApiOperation({ summary: 'Grant free credits to a specific user (for testing)' })
  async grantCredits(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body() body: { amount: number; description?: string },
  ) {
    return this.adminService.grantCreditsToUser(adminId, userId, body.amount, body.description);
  }

  // ─── Embedding Rebuild ──────────────────────────────

  @Post('rebuild-embeddings')
  @ApiOperation({ summary: 'Rebuild all work embeddings with enriched structured data' })
  async rebuildEmbeddings() {
    const works = await this.prisma.work.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true },
      orderBy: { publishedAt: 'desc' },
    });

    let processed = 0;
    let failed = 0;

    // Process sequentially with 2-second intervals (VPS memory safe)
    for (const work of works) {
      try {
        await this.aiRecommendations.generateEmbedding(work.id);
        processed++;
        this.logger.log(`Rebuilt embedding for "${work.title}" (${processed}/${works.length})`);
      } catch (e) {
        failed++;
        this.logger.error(`Failed to rebuild embedding for "${work.title}": ${e}`);
      }
      // Wait 2 seconds between works
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return { total: works.length, processed, failed };
  }

  // ─── Letter Moderation ──────────────────────────────

  @Get('letters')
  @ApiOperation({ summary: 'Get letters for moderation' })
  @ApiQuery({ name: 'status', required: false })
  async getLettersForModeration(
    @Query('status') status?: string,
  ) {
    const where = status ? { moderationStatus: status } : {};
    const letters = await this.prisma.letter.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, displayName: true } },
        recipient: { select: { id: true, name: true, displayName: true } },
        episode: { select: { id: true, title: true, work: { select: { id: true, title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { data: letters };
  }

  @Patch('letters/:id/moderate')
  @ApiOperation({ summary: 'Approve or reject a letter' })
  async moderateLetter(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject'; reason?: string },
  ) {
    const action = body.action === 'approve' ? 'approve' : 'reject';
    const letter = await this.prisma.letter.update({
      where: { id },
      data: {
        moderationStatus: action === 'approve' ? 'approved' : 'rejected',
        moderationReason: typeof body.reason === 'string' ? body.reason : null,
      },
    });
    return { data: letter };
  }

  // ─── Foreshadowing management ───────────────────────────

  @Get('works/:workId/foreshadowings')
  @ApiOperation({ summary: 'List all foreshadowings for a work' })
  async listForeshadowings(@Param('workId') workId: string) {
    const items = await this.prisma.foreshadowing.findMany({
      where: { workId },
      orderBy: { plantedIn: 'asc' },
    });
    return { data: items };
  }

  @Patch('foreshadowings/:id/resolve')
  @ApiOperation({ summary: 'Manually resolve a foreshadowing' })
  async resolveForeshadowing(
    @Param('id') id: string,
    @Body() body: { resolvedIn: number },
  ) {
    const item = await this.prisma.foreshadowing.update({
      where: { id },
      data: { resolvedIn: body.resolvedIn, status: 'resolved' },
    });
    return { data: item };
  }

  @Patch('foreshadowings/:id')
  @ApiOperation({ summary: 'Update foreshadowing fields' })
  async updateForeshadowing(
    @Param('id') id: string,
    @Body() body: { description?: string; importance?: string; status?: string; resolvedIn?: number },
  ) {
    const data: Record<string, unknown> = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.importance !== undefined) data.importance = body.importance;
    if (body.status !== undefined) data.status = body.status;
    if (body.resolvedIn !== undefined) data.resolvedIn = body.resolvedIn;

    const item = await this.prisma.foreshadowing.update({
      where: { id },
      data,
    });
    return { data: item };
  }
}
