'use client';

import { Input } from '@/components/ui/input';
import { StepGenreTags } from '@/components/creation-wizard/step-genre-tags';
import { StepEmotionBlueprint } from '@/components/creation-wizard/step-emotion-blueprint';
import { StepTitleSynopsis } from '@/components/creation-wizard/step-title-synopsis';
import type { DesignData } from './types';
import type { WizardData } from '@/components/creation-wizard/wizard-shell';
import { designToWizard, wizardChangeToDesign } from './types';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
}

export function OverviewTab({ design, onChange }: Props) {
  const wizardData = designToWizard(design);

  function handleWizardChange(partial: Partial<WizardData>) {
    onChange(wizardChangeToDesign(partial));
  }

  return (
    <div className="p-4 space-y-8">
      {/* Genre & Tags */}
      <StepGenreTags data={wizardData} onChange={handleWizardChange} />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Emotion Blueprint */}
      <StepEmotionBlueprint data={wizardData} onChange={handleWizardChange} />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Title & Synopsis */}
      <StepTitleSynopsis data={wizardData} onChange={handleWizardChange} />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Editor-mode specific: episode count and char count */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">執筆設定</h2>
          <p className="text-sm text-muted-foreground">話数や文字数の目安を設定します。</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">話数</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={design.episodeCount || ''}
              onChange={(e) => onChange({ episodeCount: Number(e.target.value) || undefined })}
              placeholder="例: 10"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">文字数目安（1話あたり）</label>
            <Input
              type="number"
              min={500}
              max={20000}
              step={500}
              value={design.charCountPerEpisode || ''}
              onChange={(e) => onChange({ charCountPerEpisode: Number(e.target.value) || undefined })}
              placeholder="例: 3000"
              className="text-sm"
            />
          </div>
        </div>
        {design.tone !== undefined && design.tone !== '' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">トーン</label>
            <Input
              value={design.tone || ''}
              onChange={(e) => onChange({ tone: e.target.value })}
              placeholder="文体・雰囲気"
              className="text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
