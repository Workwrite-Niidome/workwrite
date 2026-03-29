import { Global, Module } from '@nestjs/common';
import { OriginalityService } from './originality.service';

@Global()
@Module({
  providers: [OriginalityService],
  exports: [OriginalityService],
})
export class OriginalityModule {}
