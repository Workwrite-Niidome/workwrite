export interface ScriptBlock {
  type: 'original' | 'environment' | 'dialogue' | 'memory' | 'scene-break' | 'reader-action';
  text: string;
  speaker?: string;
  speakerColor?: string;
}

export interface ScriptAwareness {
  text: string;
  target: string;
  type?: 'talk';
  characterId?: string;
}

export interface ScriptScene {
  header?: string;
  blocks: ScriptBlock[];
  awareness?: ScriptAwareness[];
  continues?: string;
}

export interface ExperienceScript {
  intro: {
    blocks: ScriptBlock[];
    awareness: ScriptAwareness | ScriptAwareness[];
  };
  scenes: Record<string, ScriptScene>;
}

// Legacy types (kept for backward compatibility with old components)
export type PerspectiveMode = 'protagonist' | 'character' | 'omniscient';
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';

export interface ActionSuggestion {
  type: 'move' | 'observe' | 'talk' | 'perspective' | 'time' | 'read' | 'stay';
  label: string;
  params: Record<string, string | undefined>;
}

export interface SceneBlock {
  id: string;
  type: 'environment' | 'event' | 'dialogue' | 'action' | 'break' | 'perspective_label' | 'awareness' | 'memory';
  source: 'original' | 'generated' | 'reader';
  text: string;
  speaker?: string;
  speakerColor?: string;
  spoilerProtected?: boolean;
  awarenessAction?: ActionSuggestion;
}

export interface WorldState {
  locationId: string | null;
  locationName: string;
  timeOfDay: TimeOfDay;
  timelinePosition: number;
  perspective: PerspectiveMode;
  presentCharacters: { id: string; name: string; activity: string }[];
  actions: ActionSuggestion[];
}
