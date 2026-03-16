import { Injectable } from '@nestjs/common';

export interface Stamp {
  id: string;
  name: string;
  emoji: string;
  category: 'cheer' | 'celebration' | 'emotion' | 'seasonal';
}

const STAMP_CATALOG: Stamp[] = [
  // 応援
  { id: 'cheer-1', name: 'ファイト', emoji: '💪', category: 'cheer' },
  { id: 'cheer-2', name: '応援してます', emoji: '📣', category: 'cheer' },
  { id: 'cheer-3', name: '最高', emoji: '🔥', category: 'cheer' },
  { id: 'cheer-4', name: '拍手', emoji: '👏', category: 'cheer' },
  { id: 'cheer-5', name: 'いいね', emoji: '👍', category: 'cheer' },
  // お祝い
  { id: 'cele-1', name: '完結おめでとう', emoji: '🎉', category: 'celebration' },
  { id: 'cele-2', name: '連載おめでとう', emoji: '🎊', category: 'celebration' },
  { id: 'cele-3', name: 'スター', emoji: '⭐', category: 'celebration' },
  { id: 'cele-4', name: 'トロフィー', emoji: '🏆', category: 'celebration' },
  // 感情
  { id: 'emo-1', name: '感動', emoji: '😭', category: 'emotion' },
  { id: 'emo-2', name: '笑い', emoji: '🤣', category: 'emotion' },
  { id: 'emo-3', name: 'ドキドキ', emoji: '💓', category: 'emotion' },
  { id: 'emo-4', name: '癒し', emoji: '🌸', category: 'emotion' },
  { id: 'emo-5', name: 'びっくり', emoji: '😱', category: 'emotion' },
  { id: 'emo-6', name: '尊い', emoji: '✨', category: 'emotion' },
  // 季節
  { id: 'sea-1', name: '桜', emoji: '🌸', category: 'seasonal' },
  { id: 'sea-2', name: '花火', emoji: '🎆', category: 'seasonal' },
  { id: 'sea-3', name: '紅葉', emoji: '🍁', category: 'seasonal' },
  { id: 'sea-4', name: '雪', emoji: '❄️', category: 'seasonal' },
];

const CATEGORY_LABELS: Record<string, string> = {
  cheer: '応援',
  celebration: 'お祝い',
  emotion: '感情',
  seasonal: '季節',
};

@Injectable()
export class StampsService {
  getStamps(): { stamps: Stamp[]; categories: Record<string, string> } {
    return {
      stamps: STAMP_CATALOG,
      categories: CATEGORY_LABELS,
    };
  }

  getStamp(stampId: string): Stamp | undefined {
    return STAMP_CATALOG.find((s) => s.id === stampId);
  }
}
