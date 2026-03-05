const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiClient {
  private accessToken: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', token);
      }
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
      }
    }
  }

  getToken(): string | null {
    if (this.accessToken) return this.accessToken;
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
    }
    return this.accessToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: 'Network error' } }));
      throw new ApiError(res.status, error.error?.message || 'Unknown error', error.error);
    }

    return res.json();
  }

  // Auth
  async register(data: { email: string; password: string; name: string }) {
    return this.request<{ data: AuthResponse }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ data: AuthResponse }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<{ data: AuthResponse }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // Users
  async getMyProfile() {
    return this.request<{ data: UserProfile }>('/users/me');
  }

  async updateMyProfile(data: Partial<UserProfile>) {
    return this.request<{ data: UserProfile }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Onboarding
  async getOnboardingQuestions() {
    return this.request<{ data: OnboardingQuestion[] }>('/users/me/onboarding/questions');
  }

  async submitOnboarding(answers: OnboardingAnswer[]) {
    return this.request<{ data: { emotionVector: Record<string, number> } }>(
      '/users/me/onboarding',
      { method: 'POST', body: JSON.stringify({ answers }) },
    );
  }

  async getOnboardingStatus() {
    return this.request<{ data: { completed: boolean } }>('/users/me/onboarding/status');
  }

  // Reading History Import
  async importReadingHistory(items: { title: string; author?: string }[]) {
    return this.request<{ data: { imported: number } }>('/reading-history/import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async getReadingHistory() {
    return this.request<{ data: ReadingHistoryItem[] }>('/reading-history');
  }

  // Works
  async getWorks(params?: { genre?: string; cursor?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.genre) qs.set('genre', params.genre);
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    return this.request<{ data: Work[]; meta: { total: number; cursor?: string; hasMore: boolean } }>(
      `/works?${qs.toString()}`,
    );
  }

  async getWork(id: string) {
    return this.request<{ data: Work }>(`/works/${id}`);
  }

  async getMyWorks() {
    return this.request<{ data: Work[] }>('/works/mine');
  }

  async createWork(data: { title: string; synopsis?: string; genre?: string; tags?: string[] }) {
    return this.request<{ data: Work }>('/works', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWork(id: string, data: Partial<Work>) {
    return this.request<{ data: Work }>(`/works/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWork(id: string) {
    return this.request<{ data: { deleted: boolean } }>(`/works/${id}`, { method: 'DELETE' });
  }

  // Episodes
  async getEpisodes(workId: string) {
    return this.request<{ data: Episode[] }>(`/works/${workId}/episodes`);
  }

  async getEpisode(id: string) {
    return this.request<{ data: Episode }>(`/episodes/${id}`);
  }

  async createEpisode(workId: string, data: { title: string; content: string }) {
    return this.request<{ data: Episode }>(`/works/${workId}/episodes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEpisode(id: string, data: Partial<Episode>) {
    return this.request<{ data: Episode }>(`/episodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteEpisode(id: string) {
    return this.request<{ data: { deleted: boolean } }>(`/episodes/${id}`, { method: 'DELETE' });
  }

  // Reading Progress
  async updateReadingProgress(data: { episodeId: string; progressPct: number; scrollPosition: number }) {
    return this.request<{ data: ReadingProgress }>('/reading/progress', {
      method: 'POST',
      body: JSON.stringify({ items: [data] }),
    });
  }

  async getReadingProgressForWork(workId: string) {
    return this.request<{ data: ReadingProgress[] }>(`/reading/progress/${workId}`);
  }

  async getResumePosition(workId: string) {
    return this.request<{ data: { episodeId: string; scrollPosition: number; progressPct: number } | null }>(
      `/reading/resume/${workId}`,
    );
  }

  // Bookshelf
  async getBookshelf(status?: 'WANT_TO_READ' | 'READING' | 'COMPLETED') {
    const qs = status ? `?status=${status}` : '';
    return this.request<{ data: BookshelfEntry[] }>(`/reading/bookshelf${qs}`);
  }

  async addToBookshelf(workId: string, status: 'WANT_TO_READ' | 'READING' | 'COMPLETED' = 'WANT_TO_READ') {
    return this.request<{ data: BookshelfEntry }>('/reading/bookshelf', {
      method: 'POST',
      body: JSON.stringify({ workId, status }),
    });
  }

  async updateBookshelfStatus(workId: string, status: 'WANT_TO_READ' | 'READING' | 'COMPLETED') {
    return this.request<{ data: BookshelfEntry }>(`/reading/bookshelf/${workId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async removeFromBookshelf(workId: string) {
    return this.request<{ data: { deleted: boolean } }>(`/reading/bookshelf/${workId}`, { method: 'DELETE' });
  }

  // Highlights
  async createHighlight(data: { episodeId: string; startPos: number; endPos: number; color?: string; memo?: string }) {
    return this.request<{ data: Highlight }>('/reading/highlights', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getHighlightsForEpisode(episodeId: string) {
    return this.request<{ data: Highlight[] }>(`/reading/highlights/episode/${episodeId}`);
  }

  async deleteHighlight(id: string) {
    return this.request<{ data: { deleted: boolean } }>(`/reading/highlights/${id}`, { method: 'DELETE' });
  }

  // Comments
  async getCommentsForEpisode(episodeId: string) {
    return this.request<{ data: Comment[] }>(`/comments/episode/${episodeId}`);
  }

  async createComment(data: { episodeId: string; content: string; paragraphId?: string }) {
    return this.request<{ data: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteComment(id: string) {
    return this.request<{ data: { deleted: boolean } }>(`/comments/${id}`, { method: 'DELETE' });
  }

  // Discover
  async searchWorks(q: string, options?: { genre?: string; emotionTags?: string[]; limit?: number; offset?: number }) {
    const qs = new URLSearchParams({ q });
    if (options?.genre) qs.set('genre', options.genre);
    if (options?.emotionTags?.length) qs.set('emotionTags', options.emotionTags.join(','));
    if (options?.limit) qs.set('limit', String(options.limit));
    if (options?.offset) qs.set('offset', String(options.offset));
    return this.request<{ data: { hits: Work[]; total: number } }>(`/discover/search?${qs.toString()}`);
  }

  async getTopPage() {
    return this.request<{ data: TopPageData }>('/discover/top');
  }

  async getHiddenGems(limit?: number) {
    const qs = limit ? `?limit=${limit}` : '';
    return this.request<{ data: Work[] }>(`/discover/hidden-gems${qs}`);
  }

  async getNextForMe(workId: string) {
    return this.request<{ data: Work[] }>(`/discover/next-for-me?workId=${workId}`);
  }

  async getWorksByEmotionTag(tagName: string) {
    return this.request<{ data: Work[] }>(`/discover/emotion/${tagName}`);
  }

  // Emotion Tags
  async getEmotionTags() {
    return this.request<{ data: EmotionTag[] }>('/emotions/tags');
  }

  async addEmotionTags(workId: string, tags: { tagId: string; intensity?: number }[]) {
    return this.request<{ data: unknown }>('/emotions/tags/batch', {
      method: 'POST',
      body: JSON.stringify({ workId, tags }),
    });
  }

  async getAggregatedEmotionTags(workId: string) {
    return this.request<{ data: AggregatedEmotionTag[] }>(`/emotions/work/${workId}/aggregate`);
  }

  // Reviews
  async getReviewsForWork(workId: string) {
    return this.request<{ data: Review[] }>(`/reviews/work/${workId}`);
  }

  async createReview(data: { workId: string; content: string }) {
    return this.request<{ data: Review }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleReviewHelpful(reviewId: string) {
    return this.request<{ data: { helpful: boolean } }>(`/reviews/${reviewId}/helpful`, { method: 'POST' });
  }

  // Reflection - State Changes
  async saveStateChanges(workId: string, changes: { axis: string; before: number; after: number }[]) {
    return this.request<{ data: unknown }>('/reflection/state-changes/batch', {
      method: 'POST',
      body: JSON.stringify({ workId, changes }),
    });
  }

  // Reflection - Timeline
  async getTimeline() {
    return this.request<{ data: TimelineData }>('/reflection/timeline');
  }

  // Reflection - Points
  async getPoints() {
    return this.request<{ data: { balance: number } }>('/reflection/points');
  }

  async getPointHistory() {
    return this.request<{ data: PointTransaction[] }>('/reflection/points/history');
  }

  // Scoring
  // Author Dashboard
  async getAuthorOverview() {
    return this.request<{ data: unknown }>('/author/overview');
  }

  async getWorkAnalytics(workId: string) {
    return this.request<{ data: unknown }>(`/author/works/${workId}/analytics`);
  }

  async getWorkEmotionCloud(workId: string) {
    return this.request<{ data: { name: string; count: number; avgIntensity: number }[] }>(`/author/works/${workId}/emotions`);
  }

  async getWorkHeatmap(workId: string) {
    return this.request<{ data: { episodeId: string; title: string; orderIndex: number; readers: number; avgProgress: number }[] }>(
      `/author/works/${workId}/heatmap`,
    );
  }

  async getAuthorRevenue() {
    return this.request<{ data: unknown }>('/author/revenue');
  }

  // Scoring
  async triggerScoring(workId: string) {
    return this.request<{ data: QualityScoreDetail | null }>(`/scoring/works/${workId}`, { method: 'POST' });
  }

  async getScoreAnalysis(workId: string) {
    return this.request<{ data: QualityScoreDetail | null }>(`/scoring/works/${workId}/analysis`);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

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
  coverUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  genre: string | null;
  author: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
  tags: { id: string; tag: string; type: string }[];
  qualityScore?: { overall: number } | null;
  episodes?: { id: string; title: string; orderIndex: number; wordCount: number }[];
  _count?: { reviews: number; episodes: number };
  createdAt: string;
  updatedAt: string;
}

export interface Episode {
  id: string;
  workId: string;
  title: string;
  content: string;
  orderIndex: number;
  wordCount: number;
  publishedAt: string | null;
}

export interface ReadingProgress {
  id: string;
  episodeId: string;
  progressPct: number;
  scrollPosition: number;
  completedAt: string | null;
}

export interface BookshelfEntry {
  id: string;
  workId: string;
  status: 'WANT_TO_READ' | 'READING' | 'COMPLETED';
  work: Work;
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
  user: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
  createdAt: string;
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

export interface QualityScoreDetail {
  immersion: number;
  transformation: number;
  virality: number;
  worldBuilding: number;
  overall: number;
  analysis: Record<string, string> | null;
  tips: string[];
  scoredAt: string;
}

export interface TopPageData {
  popular: Work[];
  recent: Work[];
  hiddenGems: Work[];
  trendingTags: (EmotionTag & { count: number })[];
}

export const api = new ApiClient();
