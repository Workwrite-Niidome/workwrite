import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepGenreTags } from './step-genre-tags';
import type { WizardData } from './wizard-shell';

function makeData(overrides: Partial<WizardData> = {}): WizardData {
  return {
    genre: '',
    tags: '',
    emotionMode: 'recommended',
    coreMessage: '',
    targetEmotions: '',
    readerJourney: '',
    inspiration: '',
    readerOneLiner: '',
    characters: [],
    customFieldDefinitions: [],
    worldBuilding: {
      basics: { era: '', setting: '', civilizationLevel: '' },
      rules: [],
      terminology: [],
      history: '',
      infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
      items: [],
    },
    structureTemplate: 'kishotenketsu',
    actGroups: [],
    plotOutline: null,
    chapterOutline: [],
    title: '',
    synopsis: '',
    ...overrides,
  };
}

describe('StepGenreTags', () => {
  it('renders genre selection buttons for all supported genres', () => {
    render(<StepGenreTags data={makeData()} onChange={vi.fn()} />);

    expect(screen.getByText('ファンタジー')).toBeDefined();
    expect(screen.getByText('SF')).toBeDefined();
    expect(screen.getByText('ミステリー')).toBeDefined();
    expect(screen.getByText('恋愛')).toBeDefined();
    expect(screen.getByText('ホラー')).toBeDefined();
    expect(screen.getByText('文芸')).toBeDefined();
    expect(screen.getByText('冒険')).toBeDefined();
    expect(screen.getByText('コメディ')).toBeDefined();
    expect(screen.getByText('ドラマ')).toBeDefined();
    expect(screen.getByText('歴史')).toBeDefined();
    expect(screen.getByText('その他')).toBeDefined();
  });

  it('calls onChange with genre key when a genre button is clicked', () => {
    const onChange = vi.fn();
    render(<StepGenreTags data={makeData()} onChange={onChange} />);

    fireEvent.click(screen.getByText('ファンタジー'));

    expect(onChange).toHaveBeenCalledWith({ genre: 'fantasy' });
  });

  it('deselects a genre when clicking the already-selected genre', () => {
    const onChange = vi.fn();
    render(<StepGenreTags data={makeData({ genre: 'fantasy' })} onChange={onChange} />);

    fireEvent.click(screen.getByText('ファンタジー'));

    expect(onChange).toHaveBeenCalledWith({ genre: '' });
  });

  it('applies active styles to the currently selected genre', () => {
    render(<StepGenreTags data={makeData({ genre: 'sf' })} onChange={vi.fn()} />);

    const sfButton = screen.getByText('SF').closest('button');
    expect(sfButton?.className).toContain('bg-primary');
  });

  it('does not apply active styles to non-selected genres', () => {
    render(<StepGenreTags data={makeData({ genre: 'sf' })} onChange={vi.fn()} />);

    const fantasyButton = screen.getByText('ファンタジー').closest('button');
    expect(fantasyButton?.className).not.toContain('bg-primary');
  });

  it('renders tag input with current value', () => {
    render(<StepGenreTags data={makeData({ tags: '冒険, 友情' })} onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText('冒険, 成長, 友情') as HTMLInputElement;
    expect(input.value).toBe('冒険, 友情');
  });

  it('calls onChange with updated tags when input changes', () => {
    const onChange = vi.fn();
    render(<StepGenreTags data={makeData()} onChange={onChange} />);

    const input = screen.getByPlaceholderText('冒険, 成長, 友情');
    fireEvent.change(input, { target: { value: 'アクション, 青春' } });

    expect(onChange).toHaveBeenCalledWith({ tags: 'アクション, 青春' });
  });

  it('renders the heading text', () => {
    render(<StepGenreTags data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('ジャンル・タグ')).toBeDefined();
  });

  it('renders helper text about genre-based templates', () => {
    render(<StepGenreTags data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText(/テンプレートが自動で提案/)).toBeDefined();
  });
});
