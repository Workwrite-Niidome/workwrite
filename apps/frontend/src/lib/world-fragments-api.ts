/**
 * World Fragments API client
 * 既存のapi.tsには一切触れず、独立したAPIヘルパーとして機能する
 */
import { api } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = api.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  const json = await res.json();
  return json?.data ?? json;
}

// ===== Types =====

export type WishType = 'PERSPECTIVE' | 'SIDE_STORY' | 'MOMENT' | 'WHAT_IF';

export interface WorldFragment {
  id: string;
  workId: string;
  requesterId: string;
  wish: string;
  wishType: WishType;
  scope: { upToEpisode: number };
  content: string | null;
  contentMeta: { wordCount: number; estimatedReadTime: number } | null;
  qualityScore: {
    characterConsistency: number;
    worldCoherence: number;
    literaryQuality: number;
    wishFulfillment: number;
    overall: number;
    notes?: string;
  } | null;
  status: string;
  rejectionReason: string | null;
  viewCount: number;
  applauseCount: number;
  bookmarkCount: number;
  creditCost: number;
  createdAt: string;
  publishedAt: string | null;
  hasApplauded?: boolean;
  hasBookmarked?: boolean;
}

export interface WorldCanon {
  id: string;
  workId: string;
  canonVersion: number;
  upToEpisode: number;
  characterProfiles: any[];
  worldRules: any;
  timeline: any[];
  relationships: any[];
  establishedFacts: string[];
  ambiguities: string[];
  narrativeStyle: any;
  createdAt: string;
  updatedAt: string;
}

export interface FragmentListResponse {
  fragments: WorldFragment[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

export interface CanonWork {
  id: string;
  title: string;
  synopsis: string | null;
  coverUrl: string | null;
  genre: string | null;
  completionStatus: string;
  author: { id: string; name: string; displayName: string | null };
  canon: {
    canonVersion: number;
    upToEpisode: number;
    updatedAt: string;
  };
  fragmentCount: number;
}

export interface WishSeed {
  wish: string;
  wishType: WishType;
  label: string;
}

// ===== API Methods =====

export const worldFragmentsApi = {
  /** Canon構築済み作品の一覧 */
  listCanonWorks: (): Promise<{ works: CanonWork[] }> =>
    fetchWithAuth('/world-fragments/works'),

  /** WorldCanonを取得 */
  getCanon: (workId: string): Promise<WorldCanon> =>
    fetchWithAuth(`/world-fragments/${workId}/canon`),

  /** 願いの種を取得（ランダム） */
  getWishSeeds: (workId: string, count = 5): Promise<{ seeds: WishSeed[] }> =>
    fetchWithAuth(`/world-fragments/${workId}/wish-seeds?count=${count}`),

  /** WorldCanonを構築 */
  buildCanon: (workId: string, upToEpisode?: number): Promise<WorldCanon> =>
    fetchWithAuth(`/world-fragments/${workId}/canon/build`, {
      method: 'POST',
      body: JSON.stringify({ upToEpisode }),
    }),

  /** wishを送信してFragment生成 */
  createWish: (
    workId: string,
    wish: string,
    wishType: WishType,
    upToEpisode: number,
    options?: {
      anchorEpisodeId?: string;
      anchorEventId?: string;
      timelinePosition?: number;
    },
  ): Promise<WorldFragment> =>
    fetchWithAuth(`/world-fragments/${workId}/wish`, {
      method: 'POST',
      body: JSON.stringify({ wish, wishType, upToEpisode, ...options }),
    }),

  /** Fragment一覧 */
  listFragments: (
    workId: string,
    params?: { wishType?: WishType; sort?: 'latest' | 'popular'; page?: number },
  ): Promise<FragmentListResponse> => {
    const query = new URLSearchParams();
    if (params?.wishType) query.set('wishType', params.wishType);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.page) query.set('page', String(params.page));
    const qs = query.toString();
    return fetchWithAuth(`/world-fragments/${workId}/fragments${qs ? `?${qs}` : ''}`);
  },

  /** Fragmentステータス（ポーリング用、軽量） */
  getFragmentStatus: (fragmentId: string): Promise<{
    id: string;
    status: string;
    rejectionReason: string | null;
    publishedAt: string | null;
  }> =>
    fetchWithAuth(`/world-fragments/fragment/${fragmentId}/status`),

  /** Fragment詳細 */
  getFragment: (fragmentId: string): Promise<WorldFragment> =>
    fetchWithAuth(`/world-fragments/fragment/${fragmentId}`),

  /** Fragment削除（自分が生成したもののみ） */
  deleteFragment: (fragmentId: string): Promise<{ deleted: boolean }> =>
    fetchWithAuth(`/world-fragments/fragment/${fragmentId}`, { method: 'DELETE' }),

  /** 拍手トグル */
  toggleApplause: (fragmentId: string): Promise<{ applauded: boolean }> =>
    fetchWithAuth(`/world-fragments/fragment/${fragmentId}/applause`, { method: 'POST' }),

  /** ブックマークトグル */
  toggleBookmark: (fragmentId: string): Promise<{ bookmarked: boolean }> =>
    fetchWithAuth(`/world-fragments/fragment/${fragmentId}/bookmark`, { method: 'POST' }),

  /** 自分のFragments */
  myFragments: (page?: number): Promise<FragmentListResponse> => {
    const qs = page ? `?page=${page}` : '';
    return fetchWithAuth(`/world-fragments/my-fragments${qs}`);
  },
};
