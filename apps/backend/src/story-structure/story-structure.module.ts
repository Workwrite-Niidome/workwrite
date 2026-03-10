import { Module } from '@nestjs/common';
import { StoryStructureService } from './story-structure.service';
import { StoryStructureController } from './story-structure.controller';

@Module({
  controllers: [StoryStructureController],
  providers: [StoryStructureService],
  exports: [StoryStructureService],
})
export class StoryStructureModule {}
