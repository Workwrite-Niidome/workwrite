import { Module } from '@nestjs/common';
import { AuthorDashboardController } from './author-dashboard.controller';
import { AuthorDashboardService } from './author-dashboard.service';

@Module({
  controllers: [AuthorDashboardController],
  providers: [AuthorDashboardService],
})
export class AuthorDashboardModule {}
