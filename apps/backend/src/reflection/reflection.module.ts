import { Module } from '@nestjs/common';
import { ReflectionController } from './reflection.controller';
import { ReflectionService } from './reflection.service';

@Module({
  controllers: [ReflectionController],
  providers: [ReflectionService],
  exports: [ReflectionService],
})
export class ReflectionModule {}
