'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { saveDraft as saveDraftToStorage, loadDraft, deleteDraft } from '@/lib/wizard-drafts';
import { StepGenreTags } from './step-genre-tags';
import { StepEmotionBlueprint } from './step-emotion-blueprint';
import { StepCharacterDesigner } from './step-character-designer';
import { StepWorldBuilding } from './step-world-building';
import { StepPlotStructure } from './step-plot-structure';
import { StepTitleSynopsis } from './step-title-synopsis';
import { StepReview } from './step-review';

// ─── Types ──────────────────────────────────────────────────

export interface CustomFieldDef {
  id: string;
  name: string;
  inputType: 'text' | 'textarea' | 'select';
  options?: string[];
  order: number;
}

export interface WorldBuildingData {
  basics: { era: string; setting: string; civilizationLevel: string };
  rules: { id: string; name: string; description: string; constraints: string }[];
  terminology: { id: string; term: string; reading: string; definition: string }[];
  history: string;
  infoAsymmetry: { commonKnowledge: string; hiddenTruths: string };
  items: { id: string; name: string; appearance: string; ability: string;
           constraints: string; owner: string; narrativeMeaning: string }[];
}

export interface EpisodeCard {
  id: string;
  title: string;
  whatHappens: string;
  whyItHappens: string;
  characters: string[];
  emotionTarget?: string;
  aiSuggested: boolean;
}

export interface ActGroup {
  id: string;
  label: string;
  description: string;
  episodes: EpisodeCard[];
}

export interface WizardData {
  // Step 0: Genre & Tags
  genre: string;
  tags: string;
  // Step 1: Emotion Blueprint
  emotionMode: 'recommended' | 'alternative' | 'skip';
  coreMessage: string;
  targetEmotions: string;
  readerJourney: string;
  inspiration: string;
  readerOneLiner: string;
  // Step 2: Characters (AI-assisted)
  characters: any[];
  customFieldDefinitions: CustomFieldDef[];
  // Step 3: World Building
  worldBuilding: WorldBuildingData;
  // Step 4: Plot Structure (integrated plot+chapters)
  structureTemplate: string; // 'jo-ha-kyu' | 'kishotenketsu' | 'three-act' | 'beat-sheet' | 'free'
  actGroups: ActGroup[];
  plotOutline: any; // legacy support
  chapterOutline: any[]; // legacy support
  // Step 5: Title & Synopsis
  title: string;
  synopsis: string;
  // AI suggestion cache (persists across step navigation)
  _aiCharacterSuggestions?: any;
  _aiChapterSuggestions?: any;
}

const EMPTY_WORLD_BUILDING: WorldBuildingData = {
  basics: { era: '', setting: '', civilizationLevel: '' },
  rules: [],
  terminology: [],
  history: '',
  infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
  items: [],
};

const INITIAL_DATA: WizardData = {
  genre: '', tags: '',
  emotionMode: 'recommended',
  coreMessage: '', targetEmotions: '', readerJourney: '',
  inspiration: '', readerOneLiner: '',
  characters: [],
  customFieldDefinitions: [],
  worldBuilding: EMPTY_WORLD_BUILDING,
  structureTemplate: 'kishotenketsu',
  actGroups: [],
  plotOutline: null,
  chapterOutline: [],
  title: '', synopsis: '',
};

const STEPS = [
  { label: 'ジャンル・タグ', key: 'genre' },
  { label: '想いを込める', key: 'emotion' },
  { label: 'キャラクター', key: 'characters' },
  { label: '世界観', key: 'world' },
  { label: 'プロット構成', key: 'plot-structure' },
  { label: 'タイトル・あらすじ', key: 'title-synopsis' },
  { label: '確認', key: 'review' },
];

export function WizardShell() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');

  // Load existing draft or create new
  const existingDraft = typeof window !== 'undefined' && draftId ? loadDraft(draftId) : null;
  const [currentDraftId] = useState(() => draftId || crypto.randomUUID());
  const [step, setStep] = useState(existingDraft?.step ?? 0);
  const [data, setData] = useState<WizardData>(() => {
    if (existingDraft?.data) {
      // Merge old draft format with new defaults (backward compatibility)
      return { ...INITIAL_DATA, ...existingDraft.data };
    }
    return INITIAL_DATA;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showRestore, setShowRestore] = useState(!!existingDraft);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const saveDraft = useCallback((currentStep: number, currentData: WizardData) => {
    setSaveStatus('saving');
    saveDraftToStorage(currentDraftId, currentStep, currentData);
    setSaveStatus('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [currentDraftId]);

  // Auto-save on data or step change (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveDraft(step, data), 1000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [step, data, saveDraft]);

  function handleDiscard() {
    setStep(0);
    setData(INITIAL_DATA);
    deleteDraft(currentDraftId);
    setShowRestore(false);
  }

  function updateData(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
    setShowRestore(false);
  }

  function canProceed(): boolean {
    // All steps are optional except title must exist before final creation
    return true;
  }

  /** Derive chapterOutline from actGroups for backward compatibility */
  function deriveChaptersFromActGroups(groups: ActGroup[]): any[] {
    const chapters: any[] = [];
    for (const group of groups) {
      for (const ep of group.episodes) {
        chapters.push({
          title: ep.title,
          summary: [ep.whatHappens, ep.whyItHappens].filter(Boolean).join('\n'),
          characters: ep.characters,
          emotionTarget: ep.emotionTarget,
          aiSuggested: ep.aiSuggested,
        });
      }
    }
    return chapters;
  }

  async function handleCreate() {
    if (!data.title.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const tags = data.tags.split(/[,、\s]+/).filter(Boolean);
      const res = await api.createWork({
        title: data.title,
        synopsis: data.synopsis,
        genre: data.genre,
        tags,
      });
      const workId = res.data.id;

      // Derive chapter outline from actGroups if available
      const derivedChapters = data.actGroups.length > 0
        ? deriveChaptersFromActGroups(data.actGroups)
        : data.chapterOutline;

      // Build plotOutline in new structured format
      const plotData = data.actGroups.length > 0
        ? { type: 'structured', structureTemplate: data.structureTemplate, actGroups: data.actGroups }
        : data.plotOutline;

      // Save creation plan if any content exists
      const hasContent = data.characters.length > 0 || plotData || derivedChapters.length > 0 || data.coreMessage || data.inspiration;
      if (hasContent) {
        try {
          await api.saveCreationPlan(workId, {
            characters: data.characters.length > 0 ? data.characters : undefined,
            plotOutline: plotData || undefined,
            emotionBlueprint: (data.coreMessage || data.inspiration) ? {
              coreMessage: data.coreMessage,
              targetEmotions: data.targetEmotions,
              readerJourney: data.readerJourney,
              inspiration: data.inspiration,
              readerOneLiner: data.readerOneLiner,
              emotionMode: data.emotionMode,
            } : undefined,
            chapterOutline: derivedChapters.length > 0 ? derivedChapters : undefined,
            customFieldDefinitions: data.customFieldDefinitions.length > 0 ? data.customFieldDefinitions : undefined,
            worldBuildingData: data.worldBuilding,
          });

          // Auto-migrate characters to StoryCharacter table for AI context
          if (data.characters.length > 0) {
            try {
              await api.migrateCharacters(workId);
            } catch {
              // Non-critical: characters can be migrated later
            }
          }
        } catch (e) {
          console.error('Failed to save creation plan:', e);
        }
      }

      deleteDraft(currentDraftId);
      router.push(`/works/${workId}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
      setSubmitting(false);
    }
  }

  const lastStep = STEPS.length - 1;
  const isReviewStep = step === lastStep;
  // Steps that can be skipped (everything except genre-tags (0) and review)
  const canSkip = step >= 1 && step < lastStep;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Restore banner */}
      {showRestore && (
        <div className="flex items-center justify-between p-3 mb-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">下書きを復元しました</p>
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleDiscard}>
            破棄して最初から
          </Button>
        </div>
      )}

      {/* Step indicator */}
      <nav className="mb-8">
        <ol className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center">
              {i > 0 && <div className={cn('w-6 h-px mx-1', i <= step ? 'bg-primary' : 'bg-border')} />}
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={cn(
                  'flex items-center gap-1.5 text-xs py-1 px-2 rounded-full transition-colors',
                  i === step && 'bg-primary text-primary-foreground font-medium',
                  i < step && 'text-primary cursor-pointer hover:bg-primary/10',
                  i > step && 'text-muted-foreground cursor-default',
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : <span className="w-4 text-center">{i + 1}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md mb-4">{error}</div>
      )}

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === 0 && <StepGenreTags data={data} onChange={updateData} />}
        {step === 1 && <StepEmotionBlueprint data={data} onChange={updateData} />}
        {step === 2 && <StepCharacterDesigner data={data} onChange={updateData} />}
        {step === 3 && <StepWorldBuilding data={data} onChange={updateData} />}
        {step === 4 && <StepPlotStructure data={data} onChange={updateData} />}
        {step === 5 && <StepTitleSynopsis data={data} onChange={updateData} />}
        {step === 6 && <StepReview data={data} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            戻る
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 text-muted-foreground"
            onClick={() => saveDraft(step, data)}
          >
            <Save className="h-3 w-3" />
            {saveStatus === 'saved' ? '保存済み' : '下書き保存'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {canSkip && (
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => setStep((s) => s + 1)}
            >
              スキップ
            </Button>
          )}
          {!isReviewStep ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
              次へ
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={submitting || !data.title.trim()}>
              {submitting ? '作成中...' : '作品を作成'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
