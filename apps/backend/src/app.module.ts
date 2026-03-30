import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ReadingHistoryModule } from './reading-history/reading-history.module';
import { WorksModule } from './works/works.module';
import { EpisodesModule } from './episodes/episodes.module';
import { ReadingModule } from './reading/reading.module';
import { BookshelfModule } from './bookshelf/bookshelf.module';
import { HighlightsModule } from './highlights/highlights.module';
import { CommentsModule } from './comments/comments.module';
import { SearchModule } from './search/search.module';
import { DiscoverModule } from './discover/discover.module';
import { EmotionsModule } from './emotions/emotions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReflectionModule } from './reflection/reflection.module';
import { ScoringModule } from './scoring/scoring.module';
import { AuthorDashboardModule } from './author-dashboard/author-dashboard.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { AiSettingsModule } from './ai-settings/ai-settings.module';
import { PromptTemplatesModule } from './prompt-templates/prompt-templates.module';
import { AiAssistModule } from './ai-assist/ai-assist.module';
import { AiInsightsModule } from './ai-insights/ai-insights.module';
import { AiRecommendationsModule } from './ai-recommendations/ai-recommendations.module';
import { AiCompanionModule } from './ai-companion/ai-companion.module';
import { CharacterTalkModule } from './character-talk/character-talk.module';
import { WorkImportModule } from './work-import/work-import.module';
import { FollowsModule } from './follows/follows.module';
import { LettersModule } from './letters/letters.module';
import { CreationWizardModule } from './creation-wizard/creation-wizard.module';
import { EditorModeModule } from './editor-mode/editor-mode.module';
import { StoryStructureModule } from './story-structure/story-structure.module';
import { PostsModule } from './posts/posts.module';
import { TimelineModule } from './timeline/timeline.module';
import { BillingModule } from './billing/billing.module';
import { ReactionsModule } from './reactions/reactions.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { WorkExportModule } from './work-export/work-export.module';
import { OriginalityModule } from './originality/originality.module';
import { InteractiveNovelModule } from './interactive-novel/interactive-novel.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    BillingModule,
    SearchModule,
    AuthModule,
    UsersModule,
    OnboardingModule,
    ReadingHistoryModule,
    WorksModule,
    EpisodesModule,
    ReadingModule,
    BookshelfModule,
    HighlightsModule,
    CommentsModule,
    DiscoverModule,
    EmotionsModule,
    ReviewsModule,
    ReflectionModule,
    ScoringModule,
    AuthorDashboardModule,
    PaymentsModule,
    NotificationsModule,
    AdminModule,
    AiSettingsModule,
    PromptTemplatesModule,
    AiAssistModule,
    AiInsightsModule,
    AiRecommendationsModule,
    AiCompanionModule,
    CharacterTalkModule,
    WorkImportModule,
    FollowsModule,
    LettersModule,
    CreationWizardModule,
    EditorModeModule,
    StoryStructureModule,
    PostsModule,
    TimelineModule,
    ReactionsModule,
    AnnouncementsModule,
    WorkExportModule,
    OriginalityModule,
    InteractiveNovelModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
