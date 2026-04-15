import { Module } from '@nestjs/common';
import { SharedWorldController } from './shared-world.controller';
import { SharedWorldService } from './shared-world.service';

@Module({
  controllers: [SharedWorldController],
  providers: [SharedWorldService],
  exports: [SharedWorldService],
})
export class SharedWorldModule {}
