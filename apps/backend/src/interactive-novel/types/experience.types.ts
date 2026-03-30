import type { PerspectiveMode, TimeOfDay } from './world.types';

export interface RenderedScene {
  environment: EnvironmentBlock;
  events: EventBlock[];
  characters: CharacterBlock[];
  actions: ActionSuggestion[];
  meta: { locationName: string; timeOfDay: TimeOfDay; perspective: PerspectiveMode };
}

export interface EnvironmentBlock {
  text: string;
  source: 'original' | 'generated' | 'cached';
}

export interface DialogueBlock {
  text: string;
  isDialogue: boolean;
  speaker?: string;
}

export interface EventBlock {
  storyEventId: string;
  renderedText: string;
  blocks?: DialogueBlock[];
  originalPassage: string | null;
  significance: 'key' | 'normal' | 'ambient';
  spoilerProtected: boolean;
  isMemory?: boolean;
}

export interface CharacterBlock {
  characterId: string;
  name: string;
  activity: string;
  interactable: boolean;
}

export interface ActionSuggestion {
  type: 'move' | 'observe' | 'talk' | 'perspective' | 'time' | 'stay' | 'read';
  label: string;
  params: Record<string, string>;
}
