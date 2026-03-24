import { Module } from '@nestjs/common';
import { StoryStructureService } from './story-structure.service';
import { StoryStructureController } from './story-structure.controller';
import { DiscoverModule } from '../discover/discover.module';

@Module({
  imports: [DiscoverModule],
  controllers: [StoryStructureController],
  providers: [StoryStructureService],
  exports: [StoryStructureService],
})
export class StoryStructureModule {}
