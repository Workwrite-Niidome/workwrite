import { Module } from '@nestjs/common';
import { InteractiveNovelController } from './interactive-novel.controller';
import { SceneComposerService } from './services/scene-composer.service';
import { WorldBuilderService } from './services/world-builder.service';
import { EventSplitterService } from './services/event-splitter.service';
import { CharacterPresenceService } from './services/character-presence.service';
import { PerspectiveRendererService } from './services/perspective-renderer.service';
import { ReaderStateService } from './services/reader-state.service';
import { WorldConversationService } from './services/world-conversation.service';
import { IntentParserService } from './services/intent-parser.service';
import { CharacterTalkModule } from '../character-talk/character-talk.module';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';

@Module({
  imports: [CharacterTalkModule, AiSettingsModule],
  controllers: [InteractiveNovelController],
  providers: [
    SceneComposerService,
    WorldBuilderService,
    EventSplitterService,
    CharacterPresenceService,
    PerspectiveRendererService,
    ReaderStateService,
    WorldConversationService,
    IntentParserService,
  ],
})
export class InteractiveNovelModule {}
