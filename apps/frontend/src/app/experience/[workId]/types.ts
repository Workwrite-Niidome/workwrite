export type PerspectiveMode = 'protagonist' | 'character' | 'omniscient';
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';

export interface ActionSuggestion {
  type: 'move' | 'observe' | 'talk' | 'perspective' | 'time';
  label: string;
  params: Record<string, string | undefined>;
}

export interface SceneBlock {
  id: string;
  type: 'environment' | 'event' | 'dialogue' | 'action' | 'break' | 'perspective_label';
  source: 'original' | 'generated' | 'reader';
  text: string;
  speaker?: string;
  speakerColor?: string;
  spoilerProtected?: boolean;
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
