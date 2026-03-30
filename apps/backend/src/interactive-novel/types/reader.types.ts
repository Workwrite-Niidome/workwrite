export type ReaderActionType = 'move' | 'observe' | 'talk' | 'perspective' | 'time_advance' | 'experience';

export interface ReaderAction {
  type: ReaderActionType;
  params: Record<string, string>;
}
