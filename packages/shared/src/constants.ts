// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Reading progress
export const PROGRESS_BATCH_INTERVAL_MS = 30_000; // 30 seconds
export const COMPLETION_THRESHOLD = 0.9; // 90% = read

// Quality score
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const HIDDEN_GEM_QUALITY_PERCENTILE = 0.8; // top 20%
export const HIDDEN_GEM_PV_PERCENTILE = 0.5;      // bottom 50%

// Points
export const POINTS_PER_REVIEW = 50;
export const POINTS_PER_EMOTION_TAG = 10;

// Emotion tags - default categories
export const EMOTION_TAG_CATEGORIES = [
  'courage',        // 勇気が出る
  'tears',          // 泣ける
  'worldview',      // 世界観が変わる
  'healing',        // 癒される
  'excitement',     // ワクワクする
  'thinking',       // 考えさせられる
  'laughter',       // 笑える
  'empathy',        // 共感する
  'awe',            // 畏敬の念
  'nostalgia',      // 懐かしい
] as const;

// Revenue split
export const AUTHOR_TIP_SHARE = 0.85;    // 85%
export const PLATFORM_TIP_SHARE = 0.15;  // 15%

// Next book suggestions
export const NEXT_BOOK_SUGGESTIONS_COUNT = 3;

// Materialized view refresh interval (minutes)
export const EMOTION_PROFILE_REFRESH_INTERVAL_MIN = 15;
