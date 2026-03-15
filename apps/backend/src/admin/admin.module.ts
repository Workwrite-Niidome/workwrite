import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AiRecommendationsModule } from '../ai-recommendations/ai-recommendations.module';

@Module({
  imports: [PrismaModule, AiRecommendationsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
