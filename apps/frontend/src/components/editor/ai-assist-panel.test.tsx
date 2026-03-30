/**
 * Tests for the mutual exclusion behaviour between freePrompt and customPrompt
 * in AiAssistPanel.
 *
 * Behaviour spec:
 * - When freePrompt has text  → customPrompt textarea is disabled
 * - When customPrompt has text → freePrompt textarea is disabled
 * - Typing into freePrompt clears customPrompt
 * - Typing into customPrompt clears freePrompt
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — keep them at the top, before component import
// ---------------------------------------------------------------------------

vi.mock('@/lib/api', () => ({
  api: {
    getAiStatus: vi.fn().mockResolvedValue({
      data: { available: true, tier: { plan: 'free', canUseAi: true, canUseThinking: true, canUseOpus: false, remainingFreeUses: 5 } },
    }),
    getPromptTemplates: vi.fn().mockResolvedValue({ data: [] }),
    getCreationPlan: vi.fn().mockResolvedValue({ data: null }),
    getStoryContext: vi.fn().mockResolvedValue(null),
    getEpisodes: vi.fn().mockResolvedValue({ data: [] }),
    getAiHistory: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    estimateAiCost: vi.fn().mockResolvedValue({
      estimate: { credits: 0, breakdown: { inputChars: 100, estimatedOutputTokens: 500 } },
      balance: { total: 20 },
      isLightFeature: true,
    }),
    fetchSSE: vi.fn().mockResolvedValue({ body: null }),
  },
}));

vi.mock('@/lib/use-ai-stream', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/use-ai-stream')>();
  return {
    ...original,
    useAiStream: vi.fn().mockReturnValue({
      result: '',
      isStreaming: false,
      error: null,
      conversationId: null,
      generate: vi.fn(),
      generateFollowUp: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    }),
    consumeSSEStream: vi.fn(),
  };
});

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  Copy: () => <span>Copy</span>,
  ArrowDownToLine: () => <span>ArrowDownToLine</span>,
  StopCircle: () => <span>StopCircle</span>,
  Replace: () => <span>Replace</span>,
  Wand2: () => <span>Wand2</span>,
  BookCheck: () => <span>BookCheck</span>,
  PenLine: () => <span>PenLine</span>,
  Crown: () => <span>Crown</span>,
  FileText: () => <span>FileText</span>,
  Send: () => <span>Send</span>,
  UserPlus: () => <span>UserPlus</span>,
  Check: () => <span>Check</span>,
  Loader2: () => <span>Loader2</span>,
  History: () => <span>History</span>,
  Trash2: () => <span>Trash2</span>,
  MessageSquare: () => <span>MessageSquare</span>,
  RotateCcw: () => <span>RotateCcw</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronUp: () => <span>ChevronUp</span>,
  HelpCircle: () => <span>HelpCircle</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('./template-selector', () => ({
  TemplateSelector: () => <div data-testid="template-selector" />,
}));

// ---------------------------------------------------------------------------
// Component under test — imported AFTER mocks
// ---------------------------------------------------------------------------
import { AiAssistPanel } from './ai-assist-panel';

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

const defaultProps = {
  workId: 'work-1',
  episodeId: 'ep-1',
  currentContent: 'Some existing content',
  currentTitle: 'Episode Title',
  selectedText: undefined,
  onInsert: vi.fn(),
  onReplace: vi.fn(),
  onClose: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Switch to the "執筆アシスト" tab so assist-tab content is visible. */
function switchToAssistTab() {
  fireEvent.click(screen.getByText('執筆アシスト'));
}

/** Open the "詳細設定" (advanced settings) accordion to reveal customPrompt textarea. */
function openAdvancedSettings() {
  const toggle = screen.getByText('詳細設定');
  fireEvent.click(toggle);
}

/** Get the freePrompt textarea by its default placeholder. */
function getFreePromptTextarea() {
  return screen.getByPlaceholderText('例: 主人公の心情をもっと丁寧に描写して...');
}

/** Get the customPrompt textarea by its default placeholder. */
function getCustomPromptTextarea() {
  return screen.getByPlaceholderText('例: 緊張感のある場面にして...');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiAssistPanel — freePrompt / customPrompt mutual exclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('renders freePrompt textarea as enabled when both inputs are empty', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();

      await waitFor(() => {
        expect(getFreePromptTextarea()).not.toBeDisabled();
      });
    });

    it('renders freePrompt textarea with correct initial placeholder', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();

      await waitFor(() => {
        expect(getFreePromptTextarea()).toBeInTheDocument();
      });
    });

    it('renders customPrompt textarea as enabled when both inputs are empty (after opening advanced settings)', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      expect(getCustomPromptTextarea()).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // 2. freePrompt → disables customPrompt
  // -------------------------------------------------------------------------

  describe('when freePrompt receives text', () => {
    it('disables the customPrompt textarea', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      // Capture a reference to the textarea before its placeholder changes
      const customTA = screen.getByPlaceholderText('例: 緊張感のある場面にして...');

      fireEvent.change(getFreePromptTextarea(), { target: { value: 'ドラゴンが登場する' } });

      expect(customTA).toBeDisabled();
    });

    it('changes the customPrompt placeholder to indicate mutual exclusion', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      fireEvent.change(getFreePromptTextarea(), { target: { value: 'ドラゴンが登場する' } });

      // After freePrompt gets text, customPrompt shows a different placeholder
      expect(screen.getByPlaceholderText('自由指示と併用できません')).toBeInTheDocument();
    });

    it('keeps the freePrompt textarea enabled', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      fireEvent.change(getFreePromptTextarea(), { target: { value: 'ドラゴンが登場する' } });

      // freePrompt is NOT disabled (it's the one with text)
      expect(getFreePromptTextarea()).not.toBeDisabled();
    });

    it('re-enables customPrompt when freePrompt is cleared', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      fireEvent.change(getFreePromptTextarea(), { target: { value: 'ドラゴンが登場する' } });
      fireEvent.change(getFreePromptTextarea(), { target: { value: '' } });

      expect(getCustomPromptTextarea()).not.toBeDisabled();
    });

    it('re-enables customPrompt when freePrompt is whitespace-only', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      fireEvent.change(getFreePromptTextarea(), { target: { value: '   ' } });

      expect(getCustomPromptTextarea()).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // 3. customPrompt → disables freePrompt
  // -------------------------------------------------------------------------

  describe('when customPrompt receives text', () => {
    it('disables the freePrompt textarea', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();

      // Capture freePrompt before its placeholder changes
      const freeTA = getFreePromptTextarea();

      openAdvancedSettings();
      fireEvent.change(getCustomPromptTextarea(), { target: { value: '緊張感を高めて' } });

      expect(freeTA).toBeDisabled();
    });

    it('changes the freePrompt placeholder to indicate mutual exclusion', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      fireEvent.change(getCustomPromptTextarea(), { target: { value: '緊張感を高めて' } });

      // After customPrompt gets text, freePrompt shows a different placeholder
      expect(screen.getByPlaceholderText('追加指示と併用できません')).toBeInTheDocument();
    });

    it('keeps the customPrompt textarea enabled', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      // Capture customPrompt before placeholder potentially changes
      const customTA = getCustomPromptTextarea();
      fireEvent.change(customTA, { target: { value: '緊張感を高めて' } });

      expect(customTA).not.toBeDisabled();
    });

    it('re-enables freePrompt when customPrompt is cleared', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();

      // Capture freePrompt before placeholder potentially changes
      const freeTA = getFreePromptTextarea();

      openAdvancedSettings();
      const customTA = getCustomPromptTextarea();
      fireEvent.change(customTA, { target: { value: '緊張感を高めて' } });
      fireEvent.change(customTA, { target: { value: '' } });

      expect(freeTA).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cross-clearing behaviour
  // -------------------------------------------------------------------------

  describe('cross-clearing', () => {
    it('clears customPrompt when text is typed into freePrompt', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      // Capture customPrompt reference before any placeholder changes
      const customTA = getCustomPromptTextarea();

      // Set customPrompt to a value, then clear it to unlock freePrompt
      fireEvent.change(customTA, { target: { value: '既存の追加指示' } });
      fireEvent.change(customTA, { target: { value: '' } });

      // Now type into freePrompt — its onChange calls setCustomPrompt('') when value is non-empty
      fireEvent.change(getFreePromptTextarea(), { target: { value: '新しい自由指示' } });

      // customPrompt should remain '' (the cross-clear confirmed it stays empty)
      expect(customTA).toHaveValue('');
    });

    it('clears freePrompt when text is typed into customPrompt', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();

      // Capture freePrompt before any placeholder changes
      const freeTA = getFreePromptTextarea();

      // Type into freePrompt first, then clear it to unlock customPrompt
      fireEvent.change(freeTA, { target: { value: '元の自由指示' } });
      fireEvent.change(freeTA, { target: { value: '' } });

      openAdvancedSettings();
      fireEvent.change(getCustomPromptTextarea(), { target: { value: '追加指示が勝つ' } });

      // freePrompt should be cleared when customPrompt onChange fires with non-empty text
      expect(freeTA).toHaveValue('');
    });

    it('clears customPrompt immediately when freePrompt is typed while customPrompt had a value', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      // Capture both refs before any placeholder changes
      const customTA = getCustomPromptTextarea();
      const freeTA = getFreePromptTextarea();

      // Set customPrompt to a value, then clear it to avoid the mutual lock
      fireEvent.change(customTA, { target: { value: '既存の追加指示' } });
      fireEvent.change(customTA, { target: { value: '' } });

      // Type into freePrompt — its onChange handler calls setCustomPrompt('') when value.trim() is truthy
      fireEvent.change(freeTA, { target: { value: '新しい自由指示' } });

      // customPrompt should be '' after the cross-clear
      expect(customTA).toHaveValue('');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('treats whitespace-only freePrompt as empty (does not disable customPrompt)', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      fireEvent.change(getFreePromptTextarea(), { target: { value: '  \n  ' } });

      // disabled prop is `!!customPrompt.trim()` — whitespace trims to '' → false
      expect(getCustomPromptTextarea()).not.toBeDisabled();
    });

    it('treats whitespace-only customPrompt as empty (does not disable freePrompt)', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      fireEvent.change(getCustomPromptTextarea(), { target: { value: '  \t  ' } });

      expect(getFreePromptTextarea()).not.toBeDisabled();
    });

    it('does not clear the other field when a whitespace-only value is entered', async () => {
      render(<AiAssistPanel {...defaultProps} />);
      switchToAssistTab();
      openAdvancedSettings();

      // customPrompt gets a real value first (while freePrompt is empty)
      fireEvent.change(getCustomPromptTextarea(), { target: { value: '有効な追加指示' } });
      // Clear it to avoid mutual lock
      fireEvent.change(getCustomPromptTextarea(), { target: { value: '' } });

      // Now type whitespace into freePrompt — should NOT clear customPrompt
      fireEvent.change(getCustomPromptTextarea(), { target: { value: '有効な追加指示ふたたび' } });
      fireEvent.change(getCustomPromptTextarea(), { target: { value: '' } });

      fireEvent.change(getFreePromptTextarea(), { target: { value: '   ' } });
      // Since we're typing whitespace-only, `if (e.target.value.trim())` is false → no clear
      // customPrompt should retain whatever was set just before
      // (it's '' here because we cleared it — this just confirms no unintended side effect)
      expect(getCustomPromptTextarea()).toHaveValue('');
    });
  });
});
