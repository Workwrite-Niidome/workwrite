import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PostsModule } from '../posts/posts.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [PostsModule, ReferralModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
