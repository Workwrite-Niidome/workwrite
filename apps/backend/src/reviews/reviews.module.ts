import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PostsModule } from '../posts/posts.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PostsModule, BillingModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
