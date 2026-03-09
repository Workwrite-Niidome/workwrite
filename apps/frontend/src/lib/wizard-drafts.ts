import type { WizardData } from '@/components/creation-wizard/wizard-shell';

export interface WizardDraft {
  id: string;
  step: number;
  data: WizardData;
  savedAt: number;
}

const STORAGE_KEY = 'workwrite-wizard-drafts';

// Migrate from old single-draft format
function migrateOldDraft() {
  const old = localStorage.getItem('workwrite-wizard-draft');
  if (!old) return;
  try {
    const parsed = JSON.parse(old);
    if (parsed?.data && typeof parsed.step === 'number') {
      const draft: WizardDraft = {
        id: crypto.randomUUID(),
        step: parsed.step,
        data: parsed.data,
        savedAt: parsed.savedAt || Date.now(),
      };
      const drafts = loadDrafts();
      drafts.push(draft);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    }
    localStorage.removeItem('workwrite-wizard-draft');
  } catch { /* ignore */ }
}

export function loadDrafts(): WizardDraft[] {
  migrateOldDraft();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return [];
}

export function loadDraft(id: string): WizardDraft | null {
  const drafts = loadDrafts();
  return drafts.find((d) => d.id === id) || null;
}

export function saveDraft(id: string, step: number, data: WizardData): void {
  const drafts = loadDrafts();
  const idx = drafts.findIndex((d) => d.id === id);
  const entry: WizardDraft = { id, step, data, savedAt: Date.now() };
  if (idx >= 0) {
    drafts[idx] = entry;
  } else {
    drafts.push(entry);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch { /* storage full */ }
}

export function deleteDraft(id: string): void {
  const drafts = loadDrafts().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}
