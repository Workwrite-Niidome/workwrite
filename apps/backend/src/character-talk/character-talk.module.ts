import { Module } from '@nestjs/common';
import { CharacterTalkController } from './character-talk.controller';
import { CharacterTalkService } from './character-talk.service';
import { CharacterTalkRevenueService } from './character-talk-revenue.service';

@Module({
  controllers: [CharacterTalkController],
  providers: [CharacterTalkService, CharacterTalkRevenueService],
})
export class CharacterTalkModule {}
