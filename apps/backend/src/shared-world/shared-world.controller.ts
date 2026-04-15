import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SharedWorldService } from './shared-world.service';
import { CreateSharedWorldDto } from './dto/create-shared-world.dto';
import { AddWorkDto } from './dto/add-work.dto';

@ApiTags('Shared World')
@Controller('shared-world')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class SharedWorldController {
  constructor(private readonly sharedWorldService: SharedWorldService) {}

  /** SharedWorldを作成 */
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSharedWorldDto,
  ) {
    return this.sharedWorldService.createSharedWorld(
      userId,
      dto.canonWorkId,
      dto.name,
      dto.description,
    );
  }

  /** 派生作品を追加 */
  @Post(':id/works')
  async addWork(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddWorkDto,
  ) {
    return this.sharedWorldService.addDerivativeWork(id, userId, dto);
  }

  /** SharedWorldを取得 */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.sharedWorldService.getSharedWorld(id);
  }

  /** workIdからSharedWorldを検索 */
  @Get('by-work/:workId')
  async getByWork(@Param('workId') workId: string) {
    return this.sharedWorldService.getSharedWorldByWork(workId);
  }

  /** 自分のSharedWorld一覧 */
  @Get('my')
  async listMy(@CurrentUser('id') userId: string) {
    return this.sharedWorldService.listByOwner(userId);
  }

  /** メンバーを招待 */
  @Post(':id/invite')
  async invite(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.sharedWorldService.inviteMember(id, userId, body.userId);
  }

  /** 招待に応答 */
  @Post(':id/respond')
  async respond(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { accept: boolean },
  ) {
    return this.sharedWorldService.respondToInvitation(id, userId, body.accept);
  }

  /** メンバー一覧 */
  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    return this.sharedWorldService.getMembers(id);
  }

  /** 自分への招待一覧 */
  @Get('invitations')
  async listInvitations(@CurrentUser('id') userId: string) {
    return this.sharedWorldService.listInvitations(userId);
  }
}
