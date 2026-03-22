import { Module } from '@nestjs/common';
import { BookshelfController } from './bookshelf.controller';
import { BookshelfService } from './bookshelf.service';
import { PostsModule } from '../posts/posts.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PostsModule, BillingModule],
  controllers: [BookshelfController],
  providers: [BookshelfService],
  exports: [BookshelfService],
})
export class BookshelfModule {}
