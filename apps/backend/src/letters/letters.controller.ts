import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LettersService } from './letters.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateLetterDto } from './dto/create-letter.dto';

@ApiTags('Letters')
@Controller('letters')
export class LettersController {
  constructor(private lettersService: LettersService) {}

  @Get('episode/:episodeId')
  @ApiOperation({ summary: 'Get letters for an episode' })
  findByEpisode(@Param('episodeId') episodeId: string) {
    return this.lettersService.findByEpisode(episodeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a letter (fan letter with tip)' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLetterDto,
  ) {
    return this.lettersService.create(userId, dto);
  }

  @Get('free-remaining')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get remaining free letters this month' })
  getFreeRemaining(@CurrentUser('id') userId: string) {
    return this.lettersService.getFreeRemaining(userId);
  }

  @Get('received')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get letters received (for authors)' })
  findReceived(@CurrentUser('id') userId: string) {
    return this.lettersService.findReceived(userId);
  }

  @Get('sent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get letters sent by current user' })
  findSent(@CurrentUser('id') userId: string) {
    return this.lettersService.findSent(userId);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get letter earnings summary (for authors)' })
  getEarnings(@CurrentUser('id') userId: string) {
    return this.lettersService.getEarnings(userId);
  }
}
