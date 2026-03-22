export interface DesignData {
  genre?: string;
  theme?: string;
  afterReading?: string;
  protagonist?: { name: string; role: string; personality: string; speechStyle: string } | string;
  characters?: { name: string; role: string; personality: string; speechStyle: string }[] | string;
  worldBuilding?: string;
  conflict?: string;
  plotOutline?: string;
  tone?: string;
  episodeCount?: number;
  charCountPerEpisode?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type DesignTab = 'overview' | 'characters' | 'world' | 'plot' | 'preview';

export const TAB_DEFINITIONS: { key: DesignTab; label: string; designKeys: string[] }[] = [
  { key: 'overview', label: '概要', designKeys: ['genre', 'theme', 'afterReading', 'tone', 'episodeCount'] },
  { key: 'characters', label: 'キャラクター', designKeys: ['protagonist', 'characters'] },
  { key: 'world', label: '世界観', designKeys: ['worldBuilding'] },
  { key: 'plot', label: 'プロット', designKeys: ['conflict', 'plotOutline'] },
  { key: 'preview', label: 'プレビュー', designKeys: [] },
];

export function isTabFilled(design: DesignData, tab: DesignTab): boolean {
  const def = TAB_DEFINITIONS.find(t => t.key === tab);
  if (!def || def.designKeys.length === 0) return false;
  return def.designKeys.some(key => {
    const val = (design as any)[key];
    if (val === undefined || val === null || val === '') return false;
    if (typeof val === 'string') return val.length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    if (typeof val === 'number') return val > 0;
    return !!val;
  });
}

export function getFilledCount(design: DesignData): number {
  const keys = ['genre', 'theme', 'afterReading', 'protagonist', 'characters', 'worldBuilding', 'conflict', 'plotOutline', 'tone', 'episodeCount'];
  return keys.filter(key => {
    const val = (design as any)[key];
    return val !== undefined && val !== null && val !== '' && val !== 0;
  }).length;
}
