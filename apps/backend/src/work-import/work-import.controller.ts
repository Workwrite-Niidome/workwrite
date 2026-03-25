import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { WorkImportService } from './work-import.service';
import {
  AnalyzeTextDto,
  ImportTextDto,
  ImportFileDto,
  ImportMultipleFilesDto,
} from './dto/work-import.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const TXT_FILE_FILTER = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.originalname.match(/\.txt$/i)) {
    cb(new BadRequestException('.txtファイルのみ対応しています'), false);
    return;
  }
  cb(null, true);
};

const FILE_UPLOAD_OPTIONS = {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: TXT_FILE_FILTER,
};

@ApiTags('Work Import')
@Controller('works/import')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkImportController {
  constructor(private importService: WorkImportService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze text for chapter detection' })
  analyzeText(@Body() dto: AnalyzeTextDto) {
    return { data: this.importService.analyzeText(dto) };
  }

  @Post('text')
  @ApiOperation({ summary: 'Import text as work with chapters' })
  async importText(
    @CurrentUser('id') userId: string,
    @Body() dto: ImportTextDto,
  ) {
    const result = await this.importService.importText(userId, dto);
    return { data: result };
  }

  // -------------------------------------------------------
  // ファイルインポート
  // -------------------------------------------------------

  @Post('file/analyze')
  @ApiOperation({ summary: 'Analyze uploaded file for chapter detection' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_OPTIONS))
  analyzeFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('ファイルが必要です');
    }
    return { data: this.importService.analyzeFile(file.buffer) };
  }

  @Post('file')
  @ApiOperation({ summary: 'Import a single text file as work' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_OPTIONS))
  async importFile(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('ファイルが必要です');
    }
    const result = await this.importService.importFile(
      userId,
      file.buffer,
      file.originalname,
      dto,
    );
    return { data: result };
  }

  @Post('files')
  @ApiOperation({ summary: 'Import multiple text files as episodes' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 100, FILE_UPLOAD_OPTIONS))
  async importMultipleFiles(
    @CurrentUser('id') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: ImportMultipleFilesDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('ファイルが必要です');
    }
    const result = await this.importService.importMultipleFiles(
      userId,
      files,
      dto,
    );
    return { data: result };
  }

  // -------------------------------------------------------
  // ステータス・履歴
  // -------------------------------------------------------

  @Get(':importId/status')
  @ApiOperation({ summary: 'Get import status' })
  async getImportStatus(
    @Param('importId') importId: string,
    @CurrentUser('id') userId: string,
  ) {
    const status = await this.importService.getImportStatus(importId, userId);
    return { data: status };
  }

  @Get()
  @ApiOperation({ summary: 'Get import history' })
  async getHistory(@CurrentUser('id') userId: string) {
    const data = await this.importService.getImportHistory(userId);
    return { data };
  }
}
