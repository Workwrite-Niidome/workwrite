import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const UPLOADS_ROOT = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
  : join(process.cwd(), 'uploads');
const AVATAR_DIR = join(UPLOADS_ROOT, 'avatars');
if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true });

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my profile' })
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my profile' })
  updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload avatar image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: AVATAR_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
          cb(new BadRequestException('画像ファイル（JPEG, PNG, GIF, WebP）のみアップロードできます') as any, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('ファイルが選択されていません');
    const baseUrl = process.env.API_BASE_URL
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
      || `http://localhost:${process.env.PORT || 3001}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${file.filename}`;
    return this.usersService.updateAvatar(userId, avatarUrl);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete avatar' })
  deleteAvatar(@CurrentUser('id') userId: string) {
    return this.usersService.updateAvatar(userId, null);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my account' })
  deleteAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public profile' })
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
