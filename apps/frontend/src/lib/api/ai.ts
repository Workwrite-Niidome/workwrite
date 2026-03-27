import { HttpClient } from './http-client';
import type {
  QualityScoreDetail,
  AiGenerationHistoryItem,
  AiInsightData,
  AiRecommendation,
  CompanionMessage,
  TalkableCharacter,
  ConversationSummary,
  CharacterTalkEarnings,
  AllConversationItem,
  PromptTemplate,
} from './types';

export function createAiMethods(http: HttpClient) {
  return {
    getAiStatus() {
      return http.request<{ data: {
        available: boolean;
        model: string;
        tier?: { plan: string; canUseAi: boolean; canUseThinking: boolean; canUseOpus?: boolean; remainingFreeUses: number | null; credits?: { total: number; monthly: number; purchased: number } };
      } }>('/ai/status');
    },

    extractCharacters(generatedText: string, existingCharacters: { name: string; role?: string }[]) {
      return http.request<{ characters: { name: string; role: string; gender: string; personality: string; speechStyle: string; description: string }[] }>('/ai/extract-characters', {
        method: 'POST',
        body: JSON.stringify({ generatedText, existingCharacters }),
      });
    },

    // Scoring
    async estimateScoringCost(workId: string) {
      const res = await http.request<{ data: {
        estimate: { credits: number; breakdown: { model: string; inputChars: number; estimatedInputTokens: number; estimatedOutputTokens: number; estimatedApiCostYen: number } };
        sonnetEstimate?: { credits: number };
        balance: { total: number; monthly: number; purchased: number };
        totalChars: number;
        episodeCount: number;
      } }>(`/scoring/works/${workId}/estimate`);
      return res.data;
    },

    triggerScoring(workId: string, model?: 'haiku' | 'sonnet') {
      const query = model ? `?model=${model}` : '';
      return http.request<{ data: { newScore: QualityScoreDetail; historyId: string; currentScore: QualityScoreDetail | null; autoAdopted: boolean } | null }>(`/scoring/works/${workId}${query}`, { method: 'POST' });
    },

    getScoreAnalysis(workId: string) {
      return http.request<{ data: QualityScoreDetail | null }>(`/scoring/works/${workId}/analysis`);
    },

    // AI Cost Estimation
    async estimateAiCost(dto: {
      templateSlug: string;
      variables: Record<string, string>;
      premiumMode?: boolean;
      aiMode?: string;
      conversationId?: string;
      followUpMessage?: string;
    }) {
      const res = await http.request<{ data: {
        estimate: { credits: number; breakdown: { model: string; inputChars: number; estimatedInputTokens: number; estimatedOutputTokens: number; estimatedApiCostYen: number } };
        balance: { total: number; monthly: number; purchased: number };
        isLightFeature: boolean;
      } }>('/ai/estimate-cost', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      return res.data;
    },

    // AI Generation History
    getAiHistory(workId: string, params?: { limit?: number; offset?: number }) {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return http.request<{ data: AiGenerationHistoryItem[]; total: number }>(`/ai/history/${workId}${query}`);
    },

    deleteAiHistory(id: string) {
      return http.request<{ deleted: boolean }>(`/ai/history/${id}`, { method: 'DELETE' });
    },

    // AI Insights
    getAiInsights(workId: string) {
      return http.request<{ data: AiInsightData }>(`/ai/insights/${workId}`);
    },

    // AI Recommendations
    getAiRecommendationsBecauseYouRead(workId: string) {
      return http.request<{ data: AiRecommendation[] }>(`/ai/recommendations/because-you-read/${workId}`);
    },

    // AI Companion
    getCompanionHistory(workId: string) {
      return http.request<{ data: CompanionMessage[] }>(`/ai/companion/${workId}/history`);
    },

    clearCompanionHistory(workId: string) {
      return http.request<{ data: { cleared: boolean } }>(`/ai/companion/${workId}`, { method: 'DELETE' });
    },

    // Character Talk
    getCharacterTalkCharacters(workId: string, episodeId?: string) {
      const qs = episodeId ? `?episodeId=${episodeId}` : '';
      return http.request<{ data: TalkableCharacter[] }>(`/ai/character-talk/${workId}/characters${qs}`);
    },

    getCharacterTalkConversations(workId: string) {
      return http.request<{ data: ConversationSummary[] }>(`/ai/character-talk/${workId}/conversations`);
    },

    getCharacterTalkHistory(workId: string, characterId?: string) {
      return http.request<{ data: CompanionMessage[] }>(`/ai/character-talk/${workId}/history${characterId ? `/${characterId}` : ''}`);
    },

    clearCharacterTalkConversation(workId: string, characterId?: string) {
      return http.request<{ data: { cleared: boolean } }>(`/ai/character-talk/${workId}/conversation${characterId ? `/${characterId}` : ''}`, { method: 'DELETE' });
    },

    getCharacterTalkEarnings() {
      return http.request<{ data: CharacterTalkEarnings }>('/ai/character-talk/earnings');
    },

    getAllCharacterTalkConversations() {
      return http.request<{ data: AllConversationItem[] }>('/ai/character-talk/all-conversations');
    },

    // AI Highlight Explanation
    explainHighlight(highlightId: string) {
      return http.request<{ data: { explanation: string } }>(`/reading/highlights/${highlightId}/ai-explain`, { method: 'POST' });
    },

    // AI Timeline Narrative
    getTimelineNarrative() {
      return http.request<{ data: { narrative: string } }>('/reflection/narrative');
    },

    // Prompt Templates
    getPromptTemplates() {
      return http.request<{ data: PromptTemplate[] }>('/prompt-templates');
    },
  };
}
