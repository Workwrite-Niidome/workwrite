import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
