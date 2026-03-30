export interface SensoryData {
  visual?: string;
  auditory?: string;
  olfactory?: string;
  tactile?: string;
  atmospheric?: string;
}

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
export type PerspectiveMode = 'protagonist' | 'character' | 'omniscient';
export type Significance = 'key' | 'normal' | 'ambient';
