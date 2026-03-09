'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { StepBasics } from './step-basics';
import { StepEmotionBlueprint } from './step-emotion-blueprint';
import { StepCharacterDesigner } from './step-character-designer';
import { StepPlotArchitect } from './step-plot-architect';
import { StepChapterOutline } from './step-chapter-outline';
import { StepReview } from './step-review';

export interface WizardData {
  // Step 1: Basics
  title: string;
  synopsis: string;
  genre: string;
  tags: string;
  // Step 2: Emotion Blueprint
  coreMessage: string;
  targetEmotions: string;
  readerJourney: string;
  // Step 3: Characters (AI-assisted)
  characters: any[];
  // Step 4: Plot (AI-assisted)
  plotOutline: any;
  // Step 5: Chapters (AI-assisted)
  chapterOutline: any[];
}

const INITIAL_DATA: WizardData = {
  title: '', synopsis: '', genre: '', tags: '',
  coreMessage: '', targetEmotions: '', readerJourney: '',
  characters: [],
  plotOutline: null,
  chapterOutline: [],
};

const STEPS = [
  { label: '基本情報', key: 'basics' },
  { label: '想いを込める', key: 'emotion' },
  { label: 'キャラクター', key: 'characters' },
  { label: 'プロット', key: 'plot' },
  { label: '章立て', key: 'chapters' },
  { label: '確認', key: 'review' },
];

export function WizardShell() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  function updateData(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function canProceed(): boolean {
    if (step === 0) return !!data.title.trim();
    return true; // AI steps are optional
  }

  async function handleCreate() {
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

      // Save creation plan if any AI-assisted content exists
      if (data.characters.length > 0 || data.plotOutline || data.chapterOutline.length > 0 || data.coreMessage) {
        try {
          await api.saveCreationPlan(workId, {
            characters: data.characters.length > 0 ? data.characters : undefined,
            plotOutline: data.plotOutline || undefined,
            emotionBlueprint: data.coreMessage ? {
              coreMessage: data.coreMessage,
              targetEmotions: data.targetEmotions,
              readerJourney: data.readerJourney,
            } : undefined,
            chapterOutline: data.chapterOutline.length > 0 ? data.chapterOutline : undefined,
          });
        } catch {
          // Plan save failure is non-critical
        }
      }

      router.push(`/works/${workId}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
        {step === 0 && <StepBasics data={data} onChange={updateData} />}
        {step === 1 && <StepEmotionBlueprint data={data} onChange={updateData} />}
        {step === 2 && <StepCharacterDesigner data={data} onChange={updateData} />}
        {step === 3 && <StepPlotArchitect data={data} onChange={updateData} />}
        {step === 4 && <StepChapterOutline data={data} onChange={updateData} />}
        {step === 5 && <StepReview data={data} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          戻る
        </Button>

        <div className="flex items-center gap-2">
          {step >= 2 && step < 5 && (
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => setStep((s) => s + 1)}
            >
              スキップ
            </Button>
          )}
          {step < 5 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
              次へ
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? '作成中...' : '作品を作成'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
