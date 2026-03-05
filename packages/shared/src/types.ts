// User roles
export type UserRole = 'reader' | 'author' | 'editor' | 'admin';

// Bookshelf status
export type BookshelfStatus = 'want_to_read' | 'reading' | 'completed';

// Work status
export type WorkStatus = 'draft' | 'published' | 'unpublished';

// Quality score axes
export interface QualityScoreAxes {
  immersion: number;      // 没入力
  transformation: number; // 変容力
  virality: number;       // 拡散力
  worldBuilding: number;  // 世界構築力
}

// Emotion tag
export interface EmotionTagData {
  tagId: string;
  name: string;
  category: string;
  intensity?: number; // 1-5
}

// State change (before/after reading)
export interface StateChange {
  axis: string;
  before: number; // 1-10
  after: number;  // 1-10
}

// API response envelope
export interface ApiResponse<T> {
  data: T;
  meta?: {
    cursor?: string;
    hasMore?: boolean;
    total?: number;
  };
}

// API error response
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Pagination params
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}
