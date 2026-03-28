export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    displayName: string | null;
    role: string;
    avatarUrl: string | null;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface OnboardingQuestion {
  id: string;
  question: string;
  options: { value: string; label: string }[];
}

export interface OnboardingAnswer {
  questionId: string;
  answer: string;
  weight: number;
}

export interface ReadingHistoryItem {
  id: string;
  title: string;
  author: string | null;
  source: string;
  importedAt: string;
}

export interface Work {
  id: string;
  title: string;
  synopsis: string | null;
  prologue: string | null;
  coverUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  genre: string | null;
  isAiGenerated?: boolean;
  enableCharacterTalk?: boolean;
  originality?: number | null;
  author: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
  tags: { id: string; tag: string; type: string }[];
  qualityScore?: { overall: number } | null;
  episodes?: { id: string; title: string; orderIndex: number; wordCount: number; chapterTitle?: string | null }[];
  _count?: { reviews: number; episodes: number };
  readerCounts?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkReaderStats {
  totalViews: number;
  totalReads: number;
  totalUniqueReaders: number;
  recentReaders7d: number;
  completionRate: number;
  avgReadTimePerReader: number;
  statusBreakdown: Record<string, number>;
  episodeAnalytics: {
    episodeId: string;
    title: string;
    orderIndex: number;
    readers: number;
    avgProgress: number;
    totalReadTimeMs: number;
    dropOffPct: number;
  }[];
  dailyNewReaders: { date: string; count: number }[];
}

export interface Episode {
  id: string;
  workId: string;
  title: string;
  content: string;
  orderIndex: number;
  wordCount: number;
  publishedAt: string | null;
  chapterTitle?: string | null;
}

export interface ReadingProgress {
  id: string;
  episodeId: string;
  progressPct: number;
  scrollPosition: number;
  lastPosition: number;
  completedAt: string | null;
}

export interface BookshelfEntry {
  id: string;
  workId: string;
  status: 'WANT_TO_READ' | 'READING' | 'COMPLETED';
  work: Work;
  progressPct?: number;
  currentEpisode?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Highlight {
  id: string;
  episodeId: string;
  startPos: number;
  endPos: number;
  color: string;
  memo: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  episodeId: string;
  content: string;
  paragraphId: string | null;
  parentId?: string | null;
  user: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
  replies?: Comment[];
  createdAt: string;
}

export type LetterType = 'SHORT' | 'STANDARD' | 'PREMIUM' | 'GIFT';

export interface Letter {
  id: string;
  senderId: string;
  recipientId: string;
  episodeId: string;
  type: LetterType;
  content: string;
  amount: number;
  isHighlighted: boolean;
  moderationStatus: string;
  sender: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
  episode?: { id: string; title: string; workId: string };
  createdAt: string;
}

export interface LetterEarnings {
  totalLetters: number;
  monthlyLetters: number;
  totalEarnings: number;
  monthlyEarnings: number;
  platformCutRate: number;
}

export interface ReadingStats {
  completedWorks: number;
  completedEpisodes: number;
  totalReadTimeMs: number;
  currentStreak: number;
  maxStreak: number;
  genreDistribution: Record<string, number>;
  topEmotionTags: { name: string; nameJa: string; count: number }[];
  monthlyActivity: { month: string; count: number }[];
}

export interface EmotionTag {
  id: string;
  name: string;
  nameJa: string;
  category: string;
  iconUrl: string | null;
}

export interface AggregatedEmotionTag {
  tag: EmotionTag;
  count: number;
  avgIntensity: number;
}

export interface Review {
  id: string;
  workId: string;
  content: string;
  user: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
  _count: { helpfuls: number };
  createdAt: string;
}

export interface TimelineData {
  timeline: {
    type: 'state_change' | 'emotion_tag' | 'review';
    date: string;
    data: unknown;
  }[];
  growthSummary: Record<string, { totalChange: number; avgChange: number; count: number }>;
  totalWorks: number;
}

export interface PointTransaction {
  id: string;
  amount: number;
  type: string;
  reason: string | null;
  createdAt: string;
}

export interface AiGenerationHistoryItem {
  id: string;
  episodeId?: string | null;
  templateSlug: string;
  promptSummary: string | null;
  messages: { role: string; content: string }[];
  creditCost: number;
  model: string | null;
  premiumMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QualityScoreDetail {
  immersion: number;
  transformation: number;
  virality: number;
  worldBuilding: number;
  characterDepth?: number;
  structuralScore?: number;
  overall: number;
  analysis: Record<string, string> | null;
  tips: string[];
  emotionTags?: string[];
  scoredAt: string;
  isImported?: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface CharacterMatch {
  id: string;
  name: string;
  role: string;
  gender: string | null;
  age: string | null;
  personality: string | null;
  speechStyle: string | null;
  firstPerson: string | null;
  appearance: string | null;
  work: {
    id: string;
    title: string;
    genre: string | null;
    synopsis: string | null;
    enableCharacterTalk: boolean;
    author: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
    qualityScore: { overall: number } | null;
  };
}

export interface AllConversationItem {
  id: string;
  workId: string;
  workTitle: string | null;
  mode: string;
  characterId: string | null;
  characterName: string | null;
  messageCount: number;
  lastMessage: { role: string; content: string } | null;
  readProgress: { readCount: number; totalCount: number } | null;
  updatedAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalWorks: number;
  totalReviews: number;
  totalComments: number;
  todayNewUsers: number;
  todayNewWorks: number;
  planCounts?: { free: number; standard: number; pro: number };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  role: string;
  isBanned: boolean;
  createdAt: string;
  _count: { works: number; reviews: number };
  subscription?: { plan: string; status: string; grantedBy?: string | null } | null;
  creditBalance?: { balance: number; monthlyBalance: number; rewardBalance: number; purchasedBalance: number } | null;
}

export interface AdminWork {
  id: string;
  title: string;
  status: string;
  genre: string | null;
  isAiGenerated: boolean;
  createdAt: string;
  author: { id: string; name: string; displayName: string | null };
  qualityScore: { overall: number } | null;
  _count: { episodes: number; reviews: number };
}

export interface AdminReview {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; displayName: string | null };
  work: { id: string; title: string };
  _count: { helpfuls: number };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
  isPinned: boolean;
  notifyAll: boolean;
  notifiedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; name: string; displayName: string | null };
}

export interface TopPageData {
  popular: Work[];
  recent: Work[];
  hiddenGems: Work[];
  trendingTags: (EmotionTag & { count: number })[];
}

export interface PromptTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  prompt: string;
  variables: string[];
  isBuiltIn: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface DraftData {
  id: string;
  workId: string;
  episodeId: string | null;
  title: string;
  content: string;
  savedAt: string;
}

export interface AiSettingItem {
  key: string;
  value: string;
  encrypted: boolean;
  updatedAt: string;
}

export interface ContinueReadingItem {
  workId: string;
  work: { id: string; title: string; author: { name: string; displayName: string | null } };
  currentEpisode: { id: string; title: string; orderIndex: number } | null;
  progressPct: number;
}

export interface AiInsightData {
  themes: { name: string; explanation: string }[];
  emotionalJourney: string;
  characterInsights: { name: string; arc: string }[];
  symbolism: { element: string; meaning: string }[];
  discussionQuestions: string[];
}

export interface AiPersonalInsightData {
  resonance: string;
  personalMeaning: string;
  growthPoints: string[];
}

export interface AiRecommendation {
  work: Work;
  reason: string;
}

export interface CompanionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface TalkableCharacter {
  id: string;
  name: string;
  role: string;
  personality?: string;
  speechStyle?: string;
}

export interface ConversationSummary {
  mode: string;
  characterId: string | null;
  characterName?: string;
  messageCount: number;
  updatedAt: string;
}

export interface CharacterTalkEarnings {
  totalRevenue: number;
  monthlyRevenue: number;
  totalSessions: number;
  monthlySessions: number;
  platformCutRate: number;
}

export interface EpisodeSnapshot {
  id: string;
  episodeId: string;
  title: string;
  wordCount: number;
  label: string | null;
  createdAt: string;
}

export interface WorkImportRecord {
  id: string;
  userId: string;
  workId: string | null;
  source: string;
  status: string;
  totalChapters: number;
  importedChapters: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface StoryCharacter {
  id: string;
  workId: string;
  name: string;
  role: string;
  gender?: string | null;
  age?: string | null;
  personality?: string | null;
  speechStyle?: string | null;
  firstPerson?: string | null;
  appearance?: string | null;
  background?: string | null;
  motivation?: string | null;
  arc?: string | null;
  notes?: string | null;
  isPublic: boolean;
  sortOrder: number;
  customFields?: Record<string, string> | null;
  relationsFrom?: { relationType: string; description?: string; to: { id: string; name: string } }[];
  relationsTo?: { relationType: string; description?: string; from: { id: string; name: string } }[];
}

export interface StoryScene {
  id: string;
  actId: string;
  episodeId?: string | null;
  title: string;
  summary?: string | null;
  emotionTarget?: string | null;
  intensity?: number | null;
  characters: string[];
  status: string;
  sortOrder: number;
}

export interface StoryAct {
  id: string;
  arcId: string;
  actNumber: number;
  title: string;
  summary?: string | null;
  turningPoint?: string | null;
  sortOrder: number;
  scenes: StoryScene[];
}

export interface StoryArc {
  id: string;
  workId: string;
  premise?: string | null;
  centralConflict?: string | null;
  themes: string[];
  acts: StoryAct[];
}

export interface PostAuthor {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface PostWork {
  id: string;
  title: string;
  genre: string | null;
  synopsis?: string | null;
  authorId?: string;
  author?: { id: string; name: string; displayName: string | null };
  _count?: { episodes: number };
}

export interface PostEpisode {
  id: string;
  title: string;
  orderIndex: number;
  workId: string;
}

export interface SnsPost {
  id: string;
  authorId: string;
  content: string;
  postType: 'ORIGINAL' | 'REPOST' | 'QUOTE' | 'REPLY' | 'AUTO_WORK' | 'AUTO_EPISODE' | 'AUTO_REVIEW' | 'AUTO_READING';
  work: PostWork | null;
  episode: PostEpisode | null;
  repostOf: SnsPost | null;
  quoteOf: SnsPost | null;
  replyToId: string | null;
  replyTo?: { id: string; author: { id: string; name: string; displayName: string | null } } | null;
  threadRootId: string | null;
  replyCount: number;
  repostCount: number;
  applauseCount: number;
  bookmarkCount: number;
  author: PostAuthor;
  hasApplauded?: boolean;
  hasBookmarked?: boolean;
  hasReposted?: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineResult {
  posts: SnsPost[];
  nextCursor: string | null;
}

export interface BillingStatus {
  plan: string;
  credits: { total: number; monthly: number; purchased: number };
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
  } | null;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  status: string;
  balance: number;
  relatedFeature: string | null;
  relatedModel: string | null;
  description: string | null;
  createdAt: string;
}
