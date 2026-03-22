'use client';

import { StepCharacterDesigner } from '@/components/creation-wizard/step-character-designer';
import type { DesignData } from './types';
import type { WizardData } from '@/components/creation-wizard/wizard-shell';
import { designToWizard, wizardChangeToDesign } from './types';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
}

export function CharactersTab({ design, onChange }: Props) {
  const wizardData = designToWizard(design);

  function handleWizardChange(partial: Partial<WizardData>) {
    onChange(wizardChangeToDesign(partial));
  }

  return (
    <div className="p-4">
      <StepCharacterDesigner data={wizardData} onChange={handleWizardChange} />
    </div>
  );
}
