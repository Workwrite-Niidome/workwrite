import type {
  WizardData,
  WorldBuildingData,
  CustomFieldDef,
  ActGroup,
  EpisodeCard,
} from '@/components/creation-wizard/wizard-shell';

// Re-export wizard types for convenience
export type { WizardData, WorldBuildingData, CustomFieldDef, ActGroup, EpisodeCard };

export interface DesignData {
  // Genre & Tags (Step 0 of wizard)
  genre?: string;
  subGenres?: string[];
  tags?: string;

  // Emotion Blueprint (Step 1 of wizard)
  emotionMode?: 'recommended' | 'alternative' | 'skip';
  coreMessage?: string;
  targetEmotions?: string;
  readerJourney?: string;
  inspiration?: string;
  readerOneLiner?: string;

  // Characters (Step 2 of wizard)
  characters?: any[];
  customFieldDefinitions?: CustomFieldDef[];

  // World Building (Step 3 of wizard)
  worldBuilding?: WorldBuildingData;

  // Plot Structure (Step 4 of wizard)
  structureTemplate?: string;
  actGroups?: ActGroup[];

  // Title & Synopsis (Step 5 of wizard)
  title?: string;
  synopsis?: string;

  // Editor-mode specific fields
  episodeCount?: number;
  charCountPerEpisode?: number;
  tone?: string;

  // Legacy fields (kept for backward compat with AI normalizeDesignUpdate)
  theme?: string;
  afterReading?: string;
  protagonist?: { name: string; role: string; personality: string; speechStyle: string } | string;
  conflict?: string;
  plotOutline?: string;

  // AI suggestion cache
  _aiCharacterSuggestions?: any;
  _aiChapterSuggestions?: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type DesignTab = 'overview' | 'characters' | 'world' | 'plot' | 'preview';

export const TAB_DEFINITIONS: { key: DesignTab; label: string; designKeys: string[] }[] = [
  { key: 'overview', label: '概要', designKeys: ['genre', 'subGenres', 'tags', 'coreMessage', 'targetEmotions', 'theme', 'afterReading', 'tone', 'episodeCount'] },
  { key: 'characters', label: 'キャラクター', designKeys: ['characters', 'customFieldDefinitions'] },
  { key: 'world', label: '世界観', designKeys: ['worldBuilding'] },
  { key: 'plot', label: 'プロット', designKeys: ['structureTemplate', 'actGroups', 'conflict', 'plotOutline'] },
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
  const keys = [
    'genre', 'subGenres', 'coreMessage', 'targetEmotions',
    'characters', 'worldBuilding',
    'structureTemplate', 'actGroups',
    'title', 'synopsis', 'episodeCount',
    // Legacy
    'theme', 'afterReading', 'protagonist', 'conflict', 'plotOutline', 'tone',
  ];
  return keys.filter(key => {
    const val = (design as any)[key];
    if (val === undefined || val === null || val === '' || val === 0) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return true;
  }).length;
}

const EMPTY_WORLD_BUILDING: WorldBuildingData = {
  basics: { era: '', setting: '', civilizationLevel: '' },
  rules: [],
  terminology: [],
  history: '',
  infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
  items: [],
};

/** Convert DesignData to WizardData for passing to wizard step components */
export function designToWizard(design: DesignData): WizardData {
  return {
    genre: design.genre || '',
    subGenres: design.subGenres || [],
    tags: design.tags || '',
    emotionMode: design.emotionMode || 'recommended',
    coreMessage: design.coreMessage || design.theme || '',
    targetEmotions: design.targetEmotions || design.afterReading || '',
    readerJourney: design.readerJourney || '',
    inspiration: design.inspiration || '',
    readerOneLiner: design.readerOneLiner || '',
    characters: design.characters || [],
    customFieldDefinitions: design.customFieldDefinitions || [],
    worldBuilding: design.worldBuilding || EMPTY_WORLD_BUILDING,
    structureTemplate: design.structureTemplate || 'kishotenketsu',
    actGroups: design.actGroups || [],
    plotOutline: null,
    chapterOutline: [],
    title: design.title || '',
    synopsis: design.synopsis || '',
    _aiCharacterSuggestions: design._aiCharacterSuggestions,
    _aiChapterSuggestions: design._aiChapterSuggestions,
  };
}

/** Convert a Partial<WizardData> change back to Partial<DesignData> */
export function wizardChangeToDesign(change: Partial<WizardData>): Partial<DesignData> {
  const result: Partial<DesignData> = {};
  if ('genre' in change) result.genre = change.genre;
  if ('subGenres' in change) result.subGenres = change.subGenres;
  if ('tags' in change) result.tags = change.tags;
  if ('emotionMode' in change) result.emotionMode = change.emotionMode;
  if ('coreMessage' in change) result.coreMessage = change.coreMessage;
  if ('targetEmotions' in change) result.targetEmotions = change.targetEmotions;
  if ('readerJourney' in change) result.readerJourney = change.readerJourney;
  if ('inspiration' in change) result.inspiration = change.inspiration;
  if ('readerOneLiner' in change) result.readerOneLiner = change.readerOneLiner;
  if ('characters' in change) result.characters = change.characters;
  if ('customFieldDefinitions' in change) result.customFieldDefinitions = change.customFieldDefinitions;
  if ('worldBuilding' in change) result.worldBuilding = change.worldBuilding;
  if ('structureTemplate' in change) result.structureTemplate = change.structureTemplate;
  if ('actGroups' in change) result.actGroups = change.actGroups;
  if ('title' in change) result.title = change.title;
  if ('synopsis' in change) result.synopsis = change.synopsis;
  if ('_aiCharacterSuggestions' in change) result._aiCharacterSuggestions = change._aiCharacterSuggestions;
  if ('_aiChapterSuggestions' in change) result._aiChapterSuggestions = change._aiChapterSuggestions;
  return result;
}
