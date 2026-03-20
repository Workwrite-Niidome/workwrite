/** Zero-cost programmatic metrics extracted from raw text */
export interface ProgrammaticMetrics {
  // Scale
  totalCharCount: number;
  episodeCount: number;
  avgEpisodeLength: number;

  // Dialogue
  dialogueRatio: number; // 0.0-1.0 ratio of text inside 「」
  dialogueLineCount: number;
  avgDialogueLength: number;

  // Sentence structure
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  shortSentenceRatio: number; // < 20 chars
  longSentenceRatio: number; // > 80 chars

  // Paragraph structure
  avgParagraphLength: number;
  paragraphCount: number;
  singleLineParagraphRatio: number;

  // Vocabulary
  uniqueKanjiCount: number;
  vocabularyRichness: number; // type-token ratio (sampled)

  // Scene indicators
  sceneBreakCount: number;

  // Pacing proxies
  exclamationDensity: number; // per 1000 chars
  questionDensity: number;
  ellipsisDensity: number;

  // Episode-level variance
  episodeLengthVariance: number;
  dialogueRatioByEpisode: number[];
}

/** Aggregated structural data from EpisodeAnalysis + design data */
export interface StructuralProfile {
  // Episode summaries
  episodeSummaries: { order: number; title: string; summary: string }[];

  // Emotional arc
  emotionalArcProgression: string[];

  // POV
  narrativePOV: string | null;
  povConsistency: boolean;

  // Foreshadowing
  totalForeshadowingsPlanted: number;
  totalForeshadowingsResolved: number;
  foreshadowingResolutionRate: number;
  unresolvedForeshadowings: string[];

  // Characters
  characterCount: number;
  characterVoiceConsistency: { name: string; samples: string[] }[];

  // World building
  worldSettingCategories: { category: string; count: number }[];
  worldSettingDetails: string[];

  // Design data (when available)
  hasDesignData: boolean;
  designedCharacterCount: number;
  designedThemes: string[];
  designedPremise: string | null;
  designedConflict: string | null;

  // Strategic text samples
  textSamples: {
    opening: string;
    midpoint: string;
    climaxRegion: string;
    ending: string;
  };

  // Analysis coverage
  analysisCoverage: number; // 0.0-1.0
}

/** Combined input fed to the scoring LLM */
export interface ScoringInput {
  title: string;
  genre: string | null;
  completionStatus: 'ONGOING' | 'COMPLETED' | 'HIATUS';
  isImported: boolean;
  metrics: ProgrammaticMetrics;
  structure: StructuralProfile;
}

export interface ScoringResult {
  immersion: number;
  transformation: number;
  virality: number;
  worldBuilding: number;
  characterDepth: number;
  structuralScore: number;
  overall: number;
  analysis: {
    immersion: string;
    transformation: string;
    virality: string;
    worldBuilding: string;
    characterDepth: string;
    structuralScore: string;
  };
  improvementTips: string[];
  emotionTags: string[];
}
