/**
 * Shared World API client
 * SharedWorld CRUD operations (ADMIN only)
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

export type SharedWorldRole = 'ORIGIN' | 'DERIVATIVE';

export interface SharedWorldWork {
  id: string;
  sharedWorldId: string;
  workId: string;
  role: SharedWorldRole;
  joinedAt: string;
  work?: {
    id: string;
    title: string;
    synopsis: string | null;
    coverUrl: string | null;
    genre: string | null;
  } | null;
}

export interface SharedWorld {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  canonWorkId: string;
  createdAt: string;
  updatedAt: string;
  works: SharedWorldWork[];
}

// ===== API Methods =====

export const sharedWorldApi = {
  /** SharedWorldを作成 */
  create: (data: {
    canonWorkId: string;
    name: string;
    description?: string;
  }): Promise<SharedWorld> =>
    fetchWithAuth('/shared-world', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 派生作品を追加 */
  addWork: (
    sharedWorldId: string,
    data: { title: string; synopsis?: string; genre?: string },
  ): Promise<{ id: string; title: string }> =>
    fetchWithAuth(`/shared-world/${sharedWorldId}/works`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** SharedWorldを取得 */
  get: (id: string): Promise<SharedWorld> =>
    fetchWithAuth(`/shared-world/${id}`),

  /** workIdからSharedWorldを検索 */
  getByWork: (workId: string): Promise<SharedWorld | null> =>
    fetchWithAuth(`/shared-world/by-work/${workId}`),

  /** 自分のSharedWorld一覧 */
  listMy: (): Promise<SharedWorld[]> =>
    fetchWithAuth('/shared-world/my'),
};
