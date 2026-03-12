import {
  Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
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
  constructor(
    private adminService: AdminService,
    private aiTier: AiTierService,
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

  // ─── Invite Code Management ────────────────────────────────

  @Get('invite-codes')
  @ApiOperation({ summary: 'List all invite codes' })
  async getInviteCodes() {
    return this.adminService.getInviteCodes();
  }

  @Post('invite-codes')
  @ApiOperation({ summary: 'Create a new invite code' })
  async createInviteCode(
    @CurrentUser('id') adminId: string,
    @Body() body: { label?: string; maxUses?: number; expiresAt?: string },
  ) {
    return this.adminService.createInviteCode(adminId, body);
  }

  @Patch('invite-codes/:id')
  @ApiOperation({ summary: 'Toggle invite code active status' })
  async toggleInviteCode(@Param('id') id: string) {
    return this.adminService.toggleInviteCode(id);
  }

  @Delete('invite-codes/:id')
  @ApiOperation({ summary: 'Delete an invite code' })
  async deleteInviteCode(@Param('id') id: string) {
    return this.adminService.deleteInviteCode(id);
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
}
