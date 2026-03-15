import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepEmotionBlueprint } from './step-emotion-blueprint';
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

describe('StepEmotionBlueprint', () => {
  // ─── Mode tabs ────────────────────────────────────────────────

  it('renders all three mode tabs', () => {
    render(<StepEmotionBlueprint data={makeData()} onChange={vi.fn()} />);

    expect(screen.getByText('伝えたいことから')).toBeDefined();
    expect(screen.getByText('別の角度から')).toBeDefined();
    expect(screen.getByText('後で考える')).toBeDefined();
  });

  it('calls onChange with emotionMode when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<StepEmotionBlueprint data={makeData({ emotionMode: 'recommended' })} onChange={onChange} />);

    fireEvent.click(screen.getByText('別の角度から'));

    expect(onChange).toHaveBeenCalledWith({ emotionMode: 'alternative' });
  });

  it('calls onChange with "skip" when "後で考える" tab is clicked', () => {
    const onChange = vi.fn();
    render(<StepEmotionBlueprint data={makeData()} onChange={onChange} />);

    fireEvent.click(screen.getByText('後で考える'));

    expect(onChange).toHaveBeenCalledWith({ emotionMode: 'skip' });
  });

  // ─── Recommended mode (default) ──────────────────────────────

  describe('recommended mode', () => {
    it('shows coreMessage, targetEmotions, and readerJourney fields', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'recommended' })} onChange={vi.fn()} />);

      expect(screen.getByText('あなたが伝えたいこと')).toBeDefined();
      expect(screen.getByText('読者に感じてほしい感情')).toBeDefined();
      expect(screen.getByText('読者の旅路')).toBeDefined();
    });

    it('displays current coreMessage value', () => {
      render(
        <StepEmotionBlueprint
          data={makeData({ emotionMode: 'recommended', coreMessage: '勇気の大切さ' })}
          onChange={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/例：どんなに孤独でも/) as HTMLTextAreaElement;
      expect(textarea.value).toBe('勇気の大切さ');
    });

    it('calls onChange with updated coreMessage on input', () => {
      const onChange = vi.fn();
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'recommended' })} onChange={onChange} />);

      const textarea = screen.getByPlaceholderText(/例：どんなに孤独でも/);
      fireEvent.change(textarea, { target: { value: '友情の価値' } });

      expect(onChange).toHaveBeenCalledWith({ coreMessage: '友情の価値' });
    });

    it('calls onChange with updated targetEmotions', () => {
      const onChange = vi.fn();
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'recommended' })} onChange={onChange} />);

      const textarea = screen.getByPlaceholderText(/例：序盤で不安と孤独/);
      fireEvent.change(textarea, { target: { value: '感動と希望' } });

      expect(onChange).toHaveBeenCalledWith({ targetEmotions: '感動と希望' });
    });

    it('calls onChange with updated readerJourney', () => {
      const onChange = vi.fn();
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'recommended' })} onChange={onChange} />);

      const textarea = screen.getByPlaceholderText(/例：自分の弱さを受け入れて/);
      fireEvent.change(textarea, { target: { value: '前を向いて歩ける' } });

      expect(onChange).toHaveBeenCalledWith({ readerJourney: '前を向いて歩ける' });
    });

    it('shows advisory note about writing from the heart', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'recommended' })} onChange={vi.fn()} />);

      expect(screen.getByText(/あなた自身の言葉で書くことが大切/)).toBeDefined();
    });
  });

  // ─── Alternative mode ─────────────────────────────────────────

  describe('alternative mode', () => {
    it('shows inspiration and readerOneLiner fields', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'alternative' })} onChange={vi.fn()} />);

      expect(screen.getByText('この作品のインスピレーション')).toBeDefined();
      expect(screen.getByText(/読者が読み終えた後/)).toBeDefined();
    });

    it('does NOT show recommended-mode fields', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'alternative' })} onChange={vi.fn()} />);

      expect(screen.queryByText('あなたが伝えたいこと')).toBeNull();
    });

    it('displays current inspiration value', () => {
      render(
        <StepEmotionBlueprint
          data={makeData({ emotionMode: 'alternative', inspiration: '夜明けの空' })}
          onChange={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/例：雨の日に見た空港/) as HTMLTextAreaElement;
      expect(textarea.value).toBe('夜明けの空');
    });

    it('calls onChange with updated inspiration', () => {
      const onChange = vi.fn();
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'alternative' })} onChange={onChange} />);

      const textarea = screen.getByPlaceholderText(/例：雨の日に見た空港/);
      fireEvent.change(textarea, { target: { value: '幼い頃の記憶' } });

      expect(onChange).toHaveBeenCalledWith({ inspiration: '幼い頃の記憶' });
    });

    it('calls onChange with updated readerOneLiner', () => {
      const onChange = vi.fn();
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'alternative' })} onChange={onChange} />);

      const textarea = screen.getByPlaceholderText(/例：「\.\.\.もう一度最初から読みたい」/);
      fireEvent.change(textarea, { target: { value: '「また読みたい」' } });

      expect(onChange).toHaveBeenCalledWith({ readerOneLiner: '「また読みたい」' });
    });
  });

  // ─── Skip mode ────────────────────────────────────────────────

  describe('skip mode', () => {
    it('shows skip message', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'skip' })} onChange={vi.fn()} />);

      expect(screen.getByText(/このステップをスキップして/)).toBeDefined();
    });

    it('does NOT show recommended-mode fields', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'skip' })} onChange={vi.fn()} />);

      expect(screen.queryByText('あなたが伝えたいこと')).toBeNull();
    });

    it('does NOT show alternative-mode fields', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'skip' })} onChange={vi.fn()} />);

      expect(screen.queryByText('この作品のインスピレーション')).toBeNull();
    });

    it('does NOT show the advisory note about writing from the heart', () => {
      render(<StepEmotionBlueprint data={makeData({ emotionMode: 'skip' })} onChange={vi.fn()} />);

      expect(screen.queryByText(/あなた自身の言葉で書くことが大切/)).toBeNull();
    });
  });

  // ─── Default/edge cases ───────────────────────────────────────

  it('defaults to recommended mode when emotionMode is undefined', () => {
    const dataWithoutMode = makeData();
    // Force emotionMode to be undefined-like by casting
    (dataWithoutMode as any).emotionMode = undefined;

    render(<StepEmotionBlueprint data={dataWithoutMode} onChange={vi.fn()} />);

    // Should show recommended mode content
    expect(screen.getByText('あなたが伝えたいこと')).toBeDefined();
  });
});
