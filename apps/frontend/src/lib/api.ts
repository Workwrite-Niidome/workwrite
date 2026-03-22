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

  /** Make an SSE streaming fetch with auto token refresh on 401. */
  async fetchSSE(path: string, body: any, signal?: AbortSignal): Promise<Response> {
    const token = this.getToken();
    const url = `${API_BASE}${path}`;

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (res.status === 401) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        const newToken = this.getToken();
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          },
          body: JSON.stringify(body),
          signal,
        });
      } else {
        this.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshToken');
        }
        this.onAuthFailure?.();
        throw new Error('認証の有効期限が切れました。再ログインしてください。');
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `サーバーエラー (${res.status})`);
    }

    return res;
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
      if (res.status === 500) {
        throw new ApiError(res.status, message || 'サーバー内部エラーが発生しました', error.error);
      }
      throw new ApiError(res.status, message, error.error);
    }

    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return res.json();
  }

  // Auth
  async register(data: { email: string; password: string; name: string; referrerId?: string }) {
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

  getTwitterAuthUrl(): string {
    return `${API_BASE}/auth/twitter`;
  }

  async twitterCallback(code: string, state: string) {
    return this.request<AuthResponse>('/auth/twitter/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
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

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/users/me/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'アバターのアップロードに失敗しました');
    }
    return res.json();
  }

  // Onboarding
  async submitOnboarding(answers: OnboardingAnswer[]) {
    return this.request<{ data: { emotionVector: Record<string, number> } }>(
      '/users/me/onboarding',
      { method: 'POST', body: JSON.stringify({ answers }) },
    );
  }

  async retakeOnboarding(answers: OnboardingAnswer[]) {
    return this.request<{ data: { emotionVector: Record<string, number> } }>(
      '/users/me/onboarding',
      { method: 'PUT', body: JSON.stringify({ answers }) },
    );
  }

  // Reading History Import
  async importReadingHistory(items: { title: string; author?: string }[]) {
    return this.request<{ data: { imported: number } }>('/reading-history/import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // Works
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

  async getWorkReaderStats(id: string) {
    return this.request<{ data: WorkReaderStats }>(`/works/${id}/reader-stats`);
  }

  // Creation Wizard
  async saveCreationPlan(workId: string, plan: {
    characters?: any[];
    plotOutline?: any;
    emotionBlueprint?: any;
    chapterOutline?: any[];
    customFieldDefinitions?: any;
    worldBuildingData?: any;
  }) {
    return this.request<{ data: any }>(`/works/${workId}/creation/plan`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    });
  }

  async getCreationPlan(workId: string) {
    return this.request<{ data: {
      characters?: any[];
      plotOutline?: any;
      emotionBlueprint?: any;
      chapterOutline?: any[];
      storySummary?: any;
      customFieldDefinitions?: any;
      worldBuildingData?: any;
    } }>(`/works/${workId}/creation/plan`);
  }

  async updateStorySummary(workId: string) {
    return this.request<{ success: boolean }>(`/works/${workId}/creation/summary`, { method: 'POST' });
  }

  async aiCheck(workId: string, episodeId: string, content?: string) {
    return this.request<{ data: {
      typos: { location: string; issue: string; suggestion: string }[];
      characterIssues: { character: string; issue: string; detail: string }[];
      plotIssues: { issue: string; detail: string }[];
    } }>(`/works/${workId}/episodes/${episodeId}/ai-check`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Episodes
  async getEpisodes(workId: string, publishedOnly = false) {
    const params = publishedOnly ? '?published=true' : '';
    return this.request<{ data: Episode[] }>(`/works/${workId}/episodes${params}`);
  }

  async getEpisode(id: string) {
    return this.request<{ data: Episode }>(`/episodes/${id}`);
  }

  async createEpisode(workId: string, data: { title: string; content: string; publish?: boolean }) {
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

  async importFromUrl(url: string, autoScore = true) {
    return this.request<{ data: { importId: string; workId: string; title: string; episodes: number; scoringResult: any } }>(
      '/works/import/url',
      { method: 'POST', body: JSON.stringify({ url, autoScore }) },
    );
  }

  async getImportStatus(importId: string) {
    return this.request<{ data: { id: string; status: string; totalChapters: number; importedChapters: number; workId?: string; errorMessage?: string } }>(
      `/works/import/${importId}/status`,
    );
  }

  // Reading Progress
  async getReadingProgress(workId: string) {
    return this.request<{ data: ReadingProgress[] }>(`/reading/progress/${workId}`);
  }

  async updateReadingProgress(workId: string, data: { episodeId: string; progressPct: number; lastPosition: number; readTimeMs: number }) {
    return this.request<{ data: ReadingProgress }>('/reading/progress', {
      method: 'POST',
      body: JSON.stringify({ workId, entries: [data] }),
    });
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

  async getBookshelfHistory() {
    return this.request<{ data: Work[] }>('/reading/bookshelf/history');
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

  // Letters (有料ファンレター)
  async getLettersForEpisode(episodeId: string) {
    return this.request<Letter[]>(`/letters/episode/${episodeId}`);
  }

  async sendLetter(data: { episodeId: string; type: LetterType; content: string; stampId?: string; giftAmount?: number }) {
    return this.request<Letter>('/letters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStamps() {
    return this.request<{ data: { stamps: { id: string; name: string; emoji: string; category: string }[]; categories: Record<string, string> } }>('/letters/stamps');
  }

  async getReceivedLetters() {
    return this.request<{ data: Letter[] }>('/letters/received');
  }

  async getSentLetters() {
    return this.request<{ data: Letter[] }>('/letters/sent');
  }

  async getLetterEarnings() {
    return this.request<{ data: { totalLetters: number; monthlyLetters: number; totalEarnings: number; monthlyEarnings: number; platformCutRate: number } }>('/letters/earnings');
  }

  // Discover
  async searchWorks(q: string, options?: { genre?: string; emotionTags?: string[]; limit?: number; offset?: number; sort?: string; aiGenerated?: boolean; category?: string }) {
    const qs = new URLSearchParams({ q });
    if (options?.genre) qs.set('genre', options.genre);
    if (options?.emotionTags?.length) qs.set('emotionTags', options.emotionTags.join(','));
    if (options?.limit) qs.set('limit', String(options.limit));
    if (options?.offset) qs.set('offset', String(options.offset));
    if (options?.sort) qs.set('sort', options.sort);
    if (options?.aiGenerated !== undefined) qs.set('aiGenerated', String(options.aiGenerated));
    if (options?.category) qs.set('category', options.category);
    return this.request<{ data: { hits: Work[]; total: number } }>(`/discover/search?${qs.toString()}`);
  }

  async getTopPage() {
    return this.request<{ data: TopPageData }>('/discover/top');
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

  // Episode Reactions
  async sendReaction(episodeId: string, data: { claps: number; emotion?: string }) {
    return this.request<{ data: { id: string; claps: number; emotion: string | null } }>(`/reactions/episode/${episodeId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEpisodeReactions(episodeId: string) {
    return this.request<{ data: { totalClaps: number; reactionCount: number; emotions: Record<string, number>; myReaction: { claps: number; emotion: string | null } | null } }>(`/reactions/episode/${episodeId}`);
  }

  async getWorkReactions(workId: string) {
    return this.request<{ data: { byEpisode: { episodeId: string; title: string; orderIndex: number; totalClaps: number; topEmotion: string | null }[]; totalClaps: number; totalReactions: number; emotions: Record<string, number> } }>(`/reactions/work/${workId}`);
  }

  async getWorkReactionFeed(workId: string) {
    return this.request<{ data: { id: string; userDisplayName: string; episodeTitle: string; episodeOrderIndex: number; claps: number; emotion: string | null; createdAt: string }[] }>(`/reactions/work/${workId}/feed`);
  }

  async getTrendingReactions() {
    return this.request<{ data: { work: { id: string; title: string; genre: string; author: { displayName: string | null; name: string } }; reactionCount: number; totalClaps: number }[] }>('/reactions/trending');
  }

  async getMyReactionFeed() {
    return this.request<{ data: { id: string; type: string; userDisplayName: string; workTitle: string; episodeTitle: string; claps: number; emotion: string | null; createdAt: string }[] }>('/reactions/my/feed');
  }

  // Reviews
  async createReview(data: { workId: string; content: string }) {
    return this.request<{ data: Review }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  // Referral
  async getReferralInfo() {
    return this.request<{ data: { code: string; count: number; maxInvites: number; creditsEarned: number } }>('/auth/referral');
  }

  // Author Dashboard
  async getAuthorOverview() {
    return this.request<{ data: unknown }>('/author/overview');
  }

  async getWorkEmotionCloud(workId: string) {
    return this.request<{ data: { name: string; count: number; avgIntensity: number }[] }>(`/author/works/${workId}/emotions`);
  }

  async getWorkHeatmap(workId: string) {
    return this.request<{ data: { episodeId: string; title: string; orderIndex: number; readers: number; avgProgress: number }[] }>(
      `/author/works/${workId}/heatmap`,
    );
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

  // Billing
  async getBillingStatus() {
    return this.request<BillingStatus>('/billing/status');
  }

  async createCheckout(plan: string) {
    return this.request<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }

  async cancelSubscription() {
    return this.request<{ success: boolean }>('/billing/cancel', { method: 'POST' });
  }

  async purchaseCredits() {
    return this.request<{ url: string }>('/billing/credits/purchase', { method: 'POST' });
  }

  async getTransactions(page?: number, limit?: number) {
    const qs = new URLSearchParams();
    if (page) qs.set('page', String(page));
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: CreditTransaction[]; total: number }>(`/billing/transactions?${qs.toString()}`);
  }

  async createPortalSession() {
    return this.request<{ url: string }>('/billing/portal', { method: 'POST' });
  }

  // Stripe Connect
  async getConnectStatus() {
    return this.request<{ data: { hasAccount: boolean; accountId: string | null; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean } }>('/billing/connect/status');
  }

  async createConnectOnboarding() {
    return this.request<{ url: string }>('/billing/connect/onboarding', { method: 'POST' });
  }

  async createConnectLoginLink() {
    return this.request<{ url: string }>('/billing/connect/login', { method: 'POST' });
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

  async grantUserPlan(userId: string, plan: 'standard' | 'premium') {
    return this.request<{ data: { granted: boolean } }>(
      `/admin/users/${userId}/plan`,
      { method: 'POST', body: JSON.stringify({ plan }) },
    );
  }

  async revokeUserPlan(userId: string) {
    return this.request<{ data: { revoked: boolean } }>(
      `/admin/users/${userId}/plan`,
      { method: 'DELETE' },
    );
  }

  // AI tier
  async getAiStatus() {
    return this.request<{ data: {
      available: boolean;
      model: string;
      tier?: { plan: string; canUseAi: boolean; canUseThinking: boolean; canUseOpus?: boolean; remainingFreeUses: number | null; credits?: { total: number; monthly: number; purchased: number } };
    } }>('/ai/status');
  }

  async extractCharacters(generatedText: string, existingCharacters: { name: string; role?: string }[]) {
    return this.request<{ characters: { name: string; role: string; gender: string; personality: string; speechStyle: string; description: string }[] }>('/ai/extract-characters', {
      method: 'POST',
      body: JSON.stringify({ generatedText, existingCharacters }),
    });
  }

  // Story Structure - Characters
  async getCharacters(workId: string) {
    return this.request<StoryCharacter[]>(`/works/${workId}/characters`);
  }

  async getPublicCharacters(workId: string) {
    return this.request<StoryCharacter[]>(`/works/${workId}/characters/public`);
  }

  async createCharacter(workId: string, data: Partial<StoryCharacter>) {
    return this.request<StoryCharacter>(`/works/${workId}/characters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCharacter(workId: string, id: string, data: Partial<StoryCharacter>) {
    return this.request<StoryCharacter>(`/works/${workId}/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCharacter(workId: string, id: string) {
    return this.request<{ deleted: boolean }>(`/works/${workId}/characters/${id}`, { method: 'DELETE' });
  }

  async migrateCharacters(workId: string) {
    return this.request<{ migrated: number }>(`/works/${workId}/characters/migrate`, { method: 'POST' });
  }

  // Story Structure - Arc
  async getStoryContext(workId: string) {
    return this.request<string | null>(`/works/${workId}/story-context`);
  }

  // === SNS (Posts / Timeline) ===

  async createPost(data: { content: string; workId?: string; episodeId?: string; highlightId?: string; replyToId?: string; quoteOfId?: string }) {
    return this.request<{ data: SnsPost }>('/posts', { method: 'POST', body: JSON.stringify(data) });
  }

  async getPost(id: string) {
    return this.request<{ data: SnsPost }>(`/posts/${id}`);
  }

  async deletePost(id: string) {
    return this.request<void>(`/posts/${id}`, { method: 'DELETE' });
  }

  async getPostReplies(postId: string, cursor?: string, limit?: number) {
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: TimelineResult }>(`/posts/${postId}/replies?${qs.toString()}`);
  }

  async applaudPost(postId: string) {
    return this.request<void>(`/posts/${postId}/applause`, { method: 'POST' });
  }

  async removeApplause(postId: string) {
    return this.request<void>(`/posts/${postId}/applause`, { method: 'DELETE' });
  }

  async repostPost(postId: string) {
    return this.request<{ data: SnsPost }>(`/posts/${postId}/repost`, { method: 'POST' });
  }

  async removeRepost(postId: string) {
    return this.request<void>(`/posts/${postId}/repost`, { method: 'DELETE' });
  }

  async bookmarkPost(postId: string) {
    return this.request<void>(`/posts/${postId}/bookmark`, { method: 'POST' });
  }

  async removePostBookmark(postId: string) {
    return this.request<void>(`/posts/${postId}/bookmark`, { method: 'DELETE' });
  }

  async getPostBookmarks(cursor?: string, limit?: number) {
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: TimelineResult }>(`/posts/bookmarks/list?${qs.toString()}`);
  }

  async getUserPosts(userId: string, cursor?: string, limit?: number) {
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: TimelineResult }>(`/posts/user/${userId}?${qs.toString()}`);
  }

  async getUserApplaudedPosts(userId: string, cursor?: string, limit?: number) {
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: TimelineResult }>(`/posts/user/${userId}/applause?${qs.toString()}`);
  }

  async getFollowingTimeline(cursor?: string, limit?: number) {
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: TimelineResult }>(`/timeline?${qs.toString()}`);
  }

  async getGlobalTimeline(cursor?: string, limit?: number) {
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: TimelineResult }>(`/timeline/global?${qs.toString()}`);
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

  async updateWorkAiGenerated(workId: string, isAiGenerated: boolean) {
    return this.request<{ data: { id: string; isAiGenerated: boolean } }>(
      `/admin/works/${workId}/ai-generated`,
      { method: 'PATCH', body: JSON.stringify({ isAiGenerated }) },
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

  // Admin Announcements
  async getAdminAnnouncements(params?: { isPublished?: string; category?: string }) {
    const qs = new URLSearchParams();
    if (params?.isPublished) qs.set('isPublished', params.isPublished);
    if (params?.category) qs.set('category', params.category);
    return this.request<{ data: Announcement[] }>(`/admin/announcements?${qs.toString()}`);
  }

  async createAnnouncement(data: { title: string; content: string; category?: string; notifyAll?: boolean; isPinned?: boolean }) {
    return this.request<{ data: Announcement }>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAnnouncement(id: string, data: Partial<{ title: string; content: string; category: string; isPinned: boolean; notifyAll: boolean }>) {
    return this.request<{ data: Announcement }>(`/admin/announcements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAnnouncement(id: string) {
    return this.request<{ data: { id: string } }>(`/admin/announcements/${id}`, { method: 'DELETE' });
  }

  async publishAnnouncement(id: string) {
    return this.request<{ data: Announcement }>(`/admin/announcements/${id}/publish`, { method: 'POST' });
  }

  async unpublishAnnouncement(id: string) {
    return this.request<{ data: Announcement }>(`/admin/announcements/${id}/unpublish`, { method: 'POST' });
  }

  // Announcements (public)
  async getAnnouncements(limit?: number) {
    const qs = new URLSearchParams();
    if (limit) qs.set('limit', String(limit));
    return this.request<{ data: Announcement[]; nextCursor: string | null }>(`/announcements?${qs.toString()}`);
  }

  async getAnnouncement(id: string) {
    return this.request<{ data: Announcement }>(`/announcements/${id}`);
  }

  // AI Status & Assist

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

  // AI Generation History
  async getAiHistory(workId: string, params?: { limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ data: AiGenerationHistoryItem[]; total: number }>(`/ai/history/${workId}${query}`);
  }

  async deleteAiHistory(id: string) {
    return this.request<{ deleted: boolean }>(`/ai/history/${id}`, { method: 'DELETE' });
  }

  // Work Structured Data (Reader View)
  async getEmotionProfile(workId: string) {
    return this.request<any>(`/works/${workId}/emotion-profile`);
  }

  async getEmotionArc(workId: string) {
    return this.request<any>(`/works/${workId}/emotion-arc`);
  }

  async getWorldData(workId: string) {
    return this.request<any>(`/works/${workId}/world`);
  }

  async updatePublicFlags(workId: string, flags: { isWorldPublic?: boolean; isEmotionPublic?: boolean }) {
    return this.request<any>(`/works/${workId}/public-flags`, {
      method: 'PUT',
      body: JSON.stringify(flags),
    });
  }

  // AI Insights
  async getAiInsights(workId: string) {
    return this.request<{ data: AiInsightData }>(`/ai/insights/${workId}`);
  }

  // AI Recommendations
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

  // Author's published works
  async getAuthorWorks(userId: string) {
    return this.request<{ data: Work[] }>(`/works/author/${userId}`);
  }

  // Public profile
  async getPublicProfile(userId: string) {
    const res = await this.request<{ id: string; name: string; displayName: string | null; bio: string | null; avatarUrl: string | null; role: string; createdAt: string; _count: { readingProgress: number; reviews: number; followers: number; following: number } }>(`/users/${userId}`);
    return { data: res as any };
  }

  async getFollowers(userId: string) {
    const res = await this.request<{ follower: { id: string; name: string; displayName: string | null; avatarUrl: string | null } }[]>(`/users/${userId}/followers`);
    // Map Follow[] to UserItem[]
    const data = (res as any[]).map((f: any) => f.follower);
    return { data };
  }

  async getFollowingList(userId: string) {
    const res = await this.request<{ following: { id: string; name: string; displayName: string | null; avatarUrl: string | null } }[]>(`/users/${userId}/following`);
    const data = (res as any[]).map((f: any) => f.following);
    return { data };
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

  // Editor Mode
  async editorModeStatus(workId: string) {
    return this.request(`/works/${workId}/editor-mode/status`);
  }

  async editorModeChat(workId: string) {
    return `${API_BASE}/works/${workId}/editor-mode/chat`;
  }

  async editorModeFinalizeDesign(workId: string, data: { totalEpisodes: number; charCountPerEpisode: number; aiMode?: string }) {
    return this.request(`/works/${workId}/editor-mode/finalize`, { method: 'POST', body: JSON.stringify(data) });
  }

  async editorModeGenerateFirst(workId: string) {
    return `${API_BASE}/works/${workId}/editor-mode/generate-first`;
  }

  async editorModeStart(workId: string, data: { aiMode: string; generationMode: string }) {
    return this.request(`/works/${workId}/editor-mode/start`, { method: 'POST', body: JSON.stringify(data) });
  }

  async editorModePause(workId: string) {
    return this.request(`/works/${workId}/editor-mode/pause`, { method: 'POST' });
  }

  async editorModeResume(workId: string, data: { aiMode: string; generationMode: string }) {
    return this.request(`/works/${workId}/editor-mode/resume`, { method: 'POST', body: JSON.stringify(data) });
  }

  async editorModeChangeMode(workId: string, data: { generationMode: string }) {
    return this.request(`/works/${workId}/editor-mode/mode`, { method: 'POST', body: JSON.stringify(data) });
  }

  async editorModeReviseEpisode(workId: string, episodeId: string) {
    return `${API_BASE}/works/${workId}/editor-mode/episodes/${episodeId}/revise`;
  }

  async editorModeRegenerateEpisode(workId: string, episodeId: string) {
    return `${API_BASE}/works/${workId}/editor-mode/episodes/${episodeId}/regenerate`;
  }

  async editorModeAutoFix(workId: string, episodeId: string) {
    return `${API_BASE}/works/${workId}/editor-mode/episodes/${episodeId}/auto-fix`;
  }

  async editorModeApproveEpisode(workId: string, episodeId: string) {
    return this.request(`/works/${workId}/editor-mode/episodes/${episodeId}/approve`, { method: 'POST' });
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
  prologue: string | null;
  coverUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  genre: string | null;
  isAiGenerated?: boolean;
  originality?: number | null;
  author: { id: string; name: string; displayName: string | null; avatarUrl: string | null };
  tags: { id: string; tag: string; type: string }[];
  qualityScore?: { overall: number } | null;
  episodes?: { id: string; title: string; orderIndex: number; wordCount: number }[];
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
  stampId: string | null;
  isHighlighted: boolean;
  isFreeQuota: boolean;
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
  subscription?: { plan: string; status: string; grantedBy?: string | null } | null;
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

// Story Structure
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

// SNS Types
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

// Billing types
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

export const api = new ApiClient();
