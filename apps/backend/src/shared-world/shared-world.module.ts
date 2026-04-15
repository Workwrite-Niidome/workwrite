import { Module } from '@nestjs/common';
import { SharedWorldController } from './shared-world.controller';
import { SharedWorldService } from './shared-world.service';
import { SharedWorldCanonService } from './shared-world-canon.service';

@Module({
  controllers: [SharedWorldController],
  providers: [SharedWorldService, SharedWorldCanonService],
  exports: [SharedWorldService, SharedWorldCanonService],
})
export class SharedWorldModule {}
