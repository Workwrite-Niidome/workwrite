'use client';

import { StepPlotStructure } from '@/components/creation-wizard/step-plot-structure';
import type { DesignData } from './types';
import type { WizardData } from '@/components/creation-wizard/wizard-shell';
import { designToWizard, wizardChangeToDesign } from './types';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
}

export function PlotTab({ design, onChange }: Props) {
  const wizardData = designToWizard(design);

  function handleWizardChange(partial: Partial<WizardData>) {
    onChange(wizardChangeToDesign(partial));
  }

  return (
    <div className="p-4">
      <StepPlotStructure data={wizardData} onChange={handleWizardChange} />
    </div>
  );
}
