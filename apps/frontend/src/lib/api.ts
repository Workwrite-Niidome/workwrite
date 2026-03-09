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

  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private onAuthFailure: (() => void) | null = null;

  setOnAuthFailure(callback: () => void) {
    this.onAuthFailure = callback;
  }

  private async tryRefreshToken(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) return this.refreshPromise;
    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const rt = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        if (!rt) return false;
        const res = await this.refreshToken(rt);
        this.setToken(res.data.accessToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', res.data.refreshToken);
        }
        return true;
      } catch {
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    skipRefresh = false,
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    } catch {
      throw new ApiError(0, 'サーバーに接続できません。バックエンドが起動しているか確認してください。');
    }

    if (res.status === 401 && !skipRefresh && !path.startsWith('/auth/')) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        return this.request<T>(path, options, true);
      }
      this.setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refreshToken');
      }
      this.onAuthFailure?.();
      throw new ApiError(401, 'Authentication failed');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: 'サーバーエラーが発生しました' } }));
      const message = error.error?.message || 'Unknown error';
      // Provide clearer messages for common HTTP errors
      if (res.status === 500) {
        throw new ApiError(res.status, 'サーバー内部エラー: データベースに接続できない可能性があります', error.error);
      }
      throw new ApiError(res.status, message, error.error);
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

  async reorderEpisodes(workId: string, items: { id: string; orderIndex: number }[]) {
    return this.request<{ data: Episode[] }>(`/works/${workId}/episodes/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
  }

  async publishEpisode(id: string) {
    return this.request<{ data: Episode }>(`/episodes/${id}/publish`, { method: 'POST' });
  }

  async unpublishEpisode(id: string) {
    return this.request<{ data: Episode }>(`/episodes/${id}/unpublish`, { method: 'POST' });
  }

  async scheduleEpisode(id: string, scheduledAt: string) {
    return this.request<{ data: Episode }>(`/episodes/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt }),
    });
  }

  // Snapshots
  async createSnapshot(episodeId: string, label?: string) {
    return this.request<{ data: EpisodeSnapshot }>(`/episodes/${episodeId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
  }

  async getSnapshots(episodeId: string) {
    return this.request<{ data: EpisodeSnapshot[] }>(`/episodes/${episodeId}/snapshots`);
  }

  async getSnapshotContent(snapshotId: string) {
    return this.request<{ data: EpisodeSnapshot & { content: string } }>(`/episodes/snapshots/${snapshotId}`);
  }

  async restoreSnapshot(snapshotId: string) {
    return this.request<{ data: Episode }>(`/episodes/snapshots/${snapshotId}/restore`, { method: 'POST' });
  }

  // Work Import
  async analyzeImportText(text: string) {
    return this.request<{ data: { chapters: { title: string; content: string; startLine: number }[] } }>(
      '/works/import/analyze',
      { method: 'POST', body: JSON.stringify({ text }) },
    );
  }

  async importWork(data: { title: string; synopsis?: string; genre?: string; chapters: { title: string; content: string }[] }) {
    return this.request<{ data: { workId: string; importId: string; chapters: number } }>(
      '/works/import/text',
      { method: 'POST', body: JSON.stringify(data) },
    );
  }

  async getImportHistory() {
    return this.request<{ data: WorkImportRecord[] }>('/works/import');
  }

  // Episode scoring
  async scoreEpisode(episodeId: string) {
    return this.request<{ data: QualityScoreDetail | null }>(`/scoring/episodes/${episodeId}`, { method: 'POST' });
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

  async updateHighlight(id: string, data: { memo?: string; color?: string }) {
    return this.request<{ data: Highlight }>(`/reading/highlights/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteHighlight(id: string) {
    return this.request<{ data: { deleted: boolean } }>(`/reading/highlights/${id}`, { method: 'DELETE' });
  }

  // Comments
  async getCommentsForEpisode(episodeId: string) {
    return this.request<{ data: Comment[] }>(`/comments/episode/${episodeId}`);
  }

  async createComment(data: { episodeId: string; content: string; paragraphId?: string; parentId?: string }) {
    return this.request<{ data: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteComment(id: string) {
    return this.request<{ data: { deleted: boolean } }>(`/comments/${id}`, { method: 'DELETE' });
  }

  // Discover
  async searchWorks(q: string, options?: { genre?: string; emotionTags?: string[]; limit?: number; offset?: number; sort?: string }) {
    const qs = new URLSearchParams({ q });
    if (options?.genre) qs.set('genre', options.genre);
    if (options?.emotionTags?.length) qs.set('emotionTags', options.emotionTags.join(','));
    if (options?.limit) qs.set('limit', String(options.limit));
    if (options?.offset) qs.set('offset', String(options.offset));
    if (options?.sort) qs.set('sort', options.sort);
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

  // Notifications
  async getNotifications(unreadOnly = false) {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    return this.request<{ data: NotificationItem[] }>(`/notifications${qs}`);
  }

  async getUnreadNotificationCount() {
    return this.request<{ data: number }>('/notifications/unread-count');
  }

  async markNotificationAsRead(id: string) {
    return this.request<{ data: unknown }>(`/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsAsRead() {
    return this.request<{ data: unknown }>('/notifications/read-all', { method: 'POST' });
  }

  // Settings
  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<{ data: { success: boolean } }>('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAccount() {
    return this.request<{ data: { deleted: boolean } }>('/users/me', { method: 'DELETE' });
  }

  // Admin
  async getAdminStats() {
    return this.request<{ data: AdminStats }>('/admin/stats');
  }

  async getAdminUsers(params?: { page?: number; limit?: number; search?: string; role?: string }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.role) qs.set('role', params.role);
    return this.request<{ data: AdminUser[]; total: number; page: number; limit: number }>(
      `/admin/users?${qs.toString()}`,
    );
  }

  async updateUserRole(userId: string, role: string) {
    return this.request<{ data: { id: string; name: string; role: string } }>(
      `/admin/users/${userId}/role`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
    );
  }

  async banUser(userId: string, isBanned: boolean) {
    return this.request<{ data: { id: string; name: string; isBanned: boolean } }>(
      `/admin/users/${userId}/ban`,
      { method: 'PATCH', body: JSON.stringify({ isBanned }) },
    );
  }

  async getAdminWorks(params?: { page?: number; limit?: number; status?: string }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    return this.request<{ data: AdminWork[]; total: number; page: number; limit: number }>(
      `/admin/works?${qs.toString()}`,
    );
  }

  async updateWorkStatus(workId: string, status: string) {
    return this.request<{ data: { id: string; title: string; status: string } }>(
      `/admin/works/${workId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    );
  }

  async getAdminReviews(params?: { page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return this.request<{ data: AdminReview[]; total: number; page: number; limit: number }>(
      `/admin/reviews?${qs.toString()}`,
    );
  }

  async deleteReviewAsAdmin(reviewId: string) {
    return this.request<{ data: { id: string } }>(`/admin/reviews/${reviewId}`, { method: 'DELETE' });
  }

  // AI Status & Assist
  async getAiStatus() {
    return this.request<{ data: { available: boolean; model: string } }>('/ai/status');
  }

  async getPromptTemplates() {
    return this.request<{ data: PromptTemplate[] }>('/prompt-templates');
  }

  // Drafts
  async saveDraft(data: { workId: string; episodeId?: string; title: string; content: string }) {
    return this.request<{ data: DraftData }>('/episodes/draft', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getDraft(workId: string, episodeId?: string) {
    const qs = episodeId ? `?episodeId=${episodeId}` : '';
    return this.request<{ data: DraftData | null }>(`/episodes/draft/${workId}${qs}`);
  }

  async deleteDraft(workId: string, episodeId?: string) {
    const qs = episodeId ? `?episodeId=${episodeId}` : '';
    return this.request<{ data: { deleted: boolean } }>(`/episodes/draft/${workId}${qs}`, { method: 'DELETE' });
  }

  // Admin AI Settings
  async getAiSettings() {
    return this.request<{ data: AiSettingItem[] }>('/admin/ai/settings');
  }

  async updateAiSetting(key: string, value: string, encrypted?: boolean) {
    return this.request<{ data: { success: boolean } }>(`/admin/ai/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value, encrypted }),
    });
  }

  async getAiUsage() {
    return this.request<{ data: { totalRequests: number; totalInputTokens: number; totalOutputTokens: number } }>('/admin/ai/usage');
  }

  async getAiUsageDaily() {
    return this.request<{ data: { date: string; requests: number; tokens: number }[] }>('/admin/ai/usage/daily');
  }

  // Admin Templates
  async getAdminTemplates() {
    return this.request<{ data: PromptTemplate[] }>('/admin/prompt-templates');
  }

  async createTemplate(data: Partial<PromptTemplate>) {
    return this.request<{ data: PromptTemplate }>('/admin/prompt-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTemplate(id: string, data: Partial<PromptTemplate>) {
    return this.request<{ data: PromptTemplate }>(`/admin/prompt-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTemplate(id: string) {
    return this.request<{ data: { deleted: boolean } }>(`/admin/prompt-templates/${id}`, { method: 'DELETE' });
  }

  async seedTemplates() {
    return this.request<{ data: { seeded: number } }>('/admin/prompt-templates/seed', { method: 'POST' });
  }

  // Continue Reading
  async getContinueReading() {
    return this.request<{ data: ContinueReadingItem[] }>('/discover/continue-reading');
  }

  // Autocomplete
  async autocomplete(q: string) {
    return this.request<{ data: { id: string; title: string; author: { name: string; displayName: string | null } }[] }>(
      `/discover/autocomplete?q=${encodeURIComponent(q)}`,
    );
  }

  // AI Insights
  async getAiInsights(workId: string) {
    return this.request<{ data: AiInsightData }>(`/ai/insights/${workId}`);
  }

  async getPersonalAiInsights(workId: string) {
    return this.request<{ data: AiPersonalInsightData }>(`/ai/insights/${workId}/personal`);
  }

  // AI Recommendations
  async getAiRecommendations() {
    return this.request<{ data: AiRecommendation[] }>('/ai/recommendations/for-me');
  }

  async getAiRecommendationsBecauseYouRead(workId: string) {
    return this.request<{ data: AiRecommendation[] }>(`/ai/recommendations/because-you-read/${workId}`);
  }

  // AI Companion
  async getCompanionHistory(workId: string) {
    return this.request<{ data: CompanionMessage[] }>(`/ai/companion/${workId}/history`);
  }

  async clearCompanionHistory(workId: string) {
    return this.request<{ data: { cleared: boolean } }>(`/ai/companion/${workId}`, { method: 'DELETE' });
  }

  // AI Highlight Explanation
  async explainHighlight(highlightId: string) {
    return this.request<{ data: { explanation: string } }>(`/reading/highlights/${highlightId}/ai-explain`, { method: 'POST' });
  }

  // AI Timeline Narrative
  async getTimelineNarrative() {
    return this.request<{ data: { narrative: string } }>('/reflection/narrative');
  }

  // Reading Stats
  async getReadingStats() {
    return this.request<{ data: ReadingStats }>('/reading/stats');
  }

  // Follow
  async followUser(userId: string) {
    return this.request<{ data: { id: string } }>(`/users/${userId}/follow`, { method: 'POST' });
  }

  async unfollowUser(userId: string) {
    return this.request<{ data: { deleted: boolean } }>(`/users/${userId}/follow`, { method: 'DELETE' });
  }

  async isFollowing(userId: string) {
    return this.request<{ data: { following: boolean } }>(`/users/${userId}/follow/status`);
  }

  async getFollowingFeed() {
    return this.request<{ data: Work[] }>('/users/me/following/feed');
  }

  // AI Onboarding Profile
  async getAiProfile() {
    return this.request<{ data: { personality: string; recommendedGenres: string[]; recommendedThemes: string[] } | null }>('/users/me/onboarding/ai-profile');
  }

  // Health check
  async checkHealth(): Promise<{ ok: boolean; db: boolean }> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) return { ok: false, db: false };
      const data = await res.json();
      return { ok: true, db: data.data?.services?.database === 'connected' || data.services?.database === 'connected' };
    } catch {
      return { ok: false, db: false };
    }
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

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalWorks: number;
  totalReviews: number;
  totalComments: number;
  todayNewUsers: number;
  todayNewWorks: number;
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
}

export interface AdminWork {
  id: string;
  title: string;
  status: string;
  genre: string | null;
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

export const api = new ApiClient();
