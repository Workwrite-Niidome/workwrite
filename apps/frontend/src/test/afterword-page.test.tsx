/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'work-1' }),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  Star: (props: any) => <svg data-testid="icon-star" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="icon-chevron" {...props} />,
  Sparkles: (props: any) => <svg data-testid="icon-sparkles" {...props} />,
  Mail: (props: any) => <svg data-testid="icon-mail" {...props} />,
  PenLine: (props: any) => <svg data-testid="icon-penline" {...props} />,
  Share2: (props: any) => <svg data-testid="icon-share" {...props} />,
  Hand: (props: any) => <svg data-testid="icon-hand" {...props} />,
  Droplets: (props: any) => <svg data-testid="icon-droplets" {...props} />,
  Heart: (props: any) => <svg data-testid="icon-heart" {...props} />,
  Zap: (props: any) => <svg data-testid="icon-zap" {...props} />,
  Flame: (props: any) => <svg data-testid="icon-flame" {...props} />,
  Brain: (props: any) => <svg data-testid="icon-brain" {...props} />,
  Check: (props: any) => <svg data-testid="icon-check" {...props} />,
  BookOpen: (props: any) => <svg data-testid="icon-bookopen" {...props} />,
  ArrowLeft: (props: any) => <svg data-testid="icon-arrowleft" {...props} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ai/insight-card', () => ({
  InsightCard: ({ title, children }: any) => <div data-testid={`insight-${title}`}>{children}</div>,
}));

vi.mock('@/components/ai/recommendation-card', () => ({
  RecommendationCard: ({ rec }: any) => <div data-testid="rec-card">{rec.work?.title}</div>,
}));

vi.mock('@/components/reader/letter-compose-dialog', () => ({
  LetterComposeDialog: ({ open, onOpenChange }: any) => (
    open ? <div data-testid="letter-dialog"><button onClick={() => onOpenChange(false)}>close</button></div> : null
  ),
}));

// Mock api
const mockApi = {
  getWork: vi.fn(),
  getEmotionTags: vi.fn(),
  getEpisodeReactions: vi.fn(),
  sendReaction: vi.fn(),
  addEmotionTags: vi.fn(),
  saveStateChanges: vi.fn(),
  getAiInsights: vi.fn(),
  getAiRecommendationsBecauseYouRead: vi.fn(),
  createReview: vi.fn(),
};
vi.mock('@/lib/api', () => ({
  api: mockApi,
}));

// Mock auth — default: authenticated
let mockIsAuthenticated = true;
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

// --- Test data ---

const makeWork = (overrides?: any) => ({
  id: 'work-1',
  title: 'テスト作品',
  episodes: [
    { id: 'ep-1', orderIndex: 1, title: '第1話' },
    { id: 'ep-2', orderIndex: 2, title: '第2話' },
    { id: 'ep-3', orderIndex: 3, title: '最終話' },
  ],
  ...overrides,
});

const noReaction = { totalClaps: 0, reactionCount: 0, emotions: {}, myReaction: null };
const existingReaction = { totalClaps: 3, reactionCount: 5, emotions: {}, myReaction: { claps: 3, emotion: 'moved' } };

// --- Helpers ---

async function renderAfterword() {
  // Dynamic import to pick up mocks
  const { default: AfterwordPage } = await import('@/app/works/[id]/afterword/page');
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<AfterwordPage />);
  });
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });
  return result!;
}

// --- Tests ---

describe('AfterwordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
    mockApi.getWork.mockResolvedValue({ data: makeWork() });
    mockApi.getEmotionTags.mockResolvedValue({ data: [
      { id: 'tag-1', nameJa: '感動' },
      { id: 'tag-2', nameJa: '切ない' },
    ]});
    mockApi.getEpisodeReactions.mockResolvedValue({ data: noReaction });
    mockApi.sendReaction.mockResolvedValue({ data: {} });
    mockApi.addEmotionTags.mockResolvedValue({ data: {} });
    mockApi.saveStateChanges.mockResolvedValue({ data: {} });
    mockApi.getAiInsights.mockResolvedValue({ data: { themes: [], emotionalJourney: '', characterInsights: [] } });
    mockApi.getAiRecommendationsBecauseYouRead.mockResolvedValue({ data: [] });
    mockApi.createReview.mockResolvedValue({ data: {} });
  });

  // ---- Rendering ----

  it('should show work title and congratulations', async () => {
    await renderAfterword();
    expect(screen.getByText('テスト作品')).toBeInTheDocument();
    expect(screen.getByText('読了おめでとうございます')).toBeInTheDocument();
  });

  it('should explain what clapping is', async () => {
    await renderAfterword();
    expect(screen.getByText(/タップで拍手を送れます/)).toBeInTheDocument();
    expect(screen.getByText(/最大5回/)).toBeInTheDocument();
  });

  it('should redirect to login if not authenticated', async () => {
    mockIsAuthenticated = false;
    const { default: AfterwordPage } = await import('@/app/works/[id]/afterword/page');
    await act(async () => { render(<AfterwordPage />); });
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('should redirect to / if work fetch fails', async () => {
    mockApi.getWork.mockRejectedValue(new Error('not found'));
    const { default: AfterwordPage } = await import('@/app/works/[id]/afterword/page');
    await act(async () => { render(<AfterwordPage />); });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });

  // ---- Existing reaction loading ----

  it('should load existing reaction from last episode', async () => {
    mockApi.getEpisodeReactions.mockResolvedValue({ data: existingReaction });
    await renderAfterword();

    // Should show claps as already sent (3 claps = "3/5 すごく良い！")
    expect(screen.getByText('3/5 すごく良い！')).toBeInTheDocument();
    expect(screen.getByText('作者に届きました')).toBeInTheDocument();
    // Should call getEpisodeReactions with the LAST episode (highest orderIndex)
    expect(mockApi.getEpisodeReactions).toHaveBeenCalledWith('ep-3');
  });

  it('should NOT auto-send reaction (no implicit API call)', async () => {
    await renderAfterword();
    // Clap once
    fireEvent.click(screen.getByTestId('icon-hand').closest('button')!);
    // Wait a bit — should NOT auto-send
    await new Promise((r) => setTimeout(r, 2000));
    expect(mockApi.sendReaction).not.toHaveBeenCalled();
  });

  // ---- Clap + Emotion + Explicit send ----

  it('should increment claps on click and show emotion options', async () => {
    await renderAfterword();
    const clapBtn = screen.getByTestId('icon-hand').closest('button')!;

    fireEvent.click(clapBtn);
    expect(screen.getByText('1/5 ありがとう！')).toBeInTheDocument();
    // Emotion options should appear
    expect(screen.getByText('泣いた')).toBeInTheDocument();
    expect(screen.getByText('温かい')).toBeInTheDocument();
  });

  it('should show explicit send button after clapping', async () => {
    await renderAfterword();
    fireEvent.click(screen.getByTestId('icon-hand').closest('button')!);
    expect(screen.getByText('作者に届ける')).toBeInTheDocument();
  });

  it('should send reaction only when send button is clicked', async () => {
    await renderAfterword();
    fireEvent.click(screen.getByTestId('icon-hand').closest('button')!);
    fireEvent.click(screen.getByText('泣いた'));

    fireEvent.click(screen.getByText('作者に届ける'));
    await waitFor(() => {
      expect(mockApi.sendReaction).toHaveBeenCalledWith('ep-3', { claps: 1, emotion: 'moved' });
    });
    expect(screen.getByText('作者に届きました')).toBeInTheDocument();
  });

  it('should cap claps at 5', async () => {
    await renderAfterword();
    const clapBtn = screen.getByTestId('icon-hand').closest('button')!;
    for (let i = 0; i < 6; i++) fireEvent.click(clapBtn);
    expect(screen.getByText('5/5 感動した！')).toBeInTheDocument();
  });

  // ---- Letter dialog (no navigation away) ----

  it('should open letter dialog in-place instead of navigating', async () => {
    await renderAfterword();
    fireEvent.click(screen.getByText('ギフトレターを送る'));
    expect(screen.getByTestId('letter-dialog')).toBeInTheDocument();
    // Should NOT have navigated
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ---- No dead comment field ----

  it('should NOT have a standalone comment textarea (removed dead UI)', async () => {
    await renderAfterword();
    expect(screen.queryByPlaceholderText('一言感想（任意）')).not.toBeInTheDocument();
  });

  // ---- Review ----

  it('should toggle review section and submit when >= 20 chars', async () => {
    await renderAfterword();
    fireEvent.click(screen.getByText('レビューを書く'));
    const textarea = screen.getByPlaceholderText('この作品について思ったことを自由に書いてください...');
    expect(textarea).toBeInTheDocument();

    // Too short
    fireEvent.change(textarea, { target: { value: '短い' } });
    expect(screen.getByText('あと18文字')).toBeInTheDocument();

    // Long enough
    fireEvent.change(textarea, { target: { value: 'この作品は非常に面白く、キャラクターの描写が素晴らしかったです。' } });
    fireEvent.click(screen.getByText('レビューを投稿して5Cr獲得'));
    await waitFor(() => {
      expect(mockApi.createReview).toHaveBeenCalledWith({
        workId: 'work-1',
        content: 'この作品は非常に面白く、キャラクターの描写が素晴らしかったです。',
      });
    });
    expect(screen.getByText(/レビューを投稿しました/)).toBeInTheDocument();
  });

  // ---- Unified tags (quick tags + emotion tags) ----

  it('should show unified tag section with quick tags and emotion tags', async () => {
    await renderAfterword();
    fireEvent.click(screen.getByText('この作品にタグをつける'));

    // Quick tags
    expect(screen.getByText('誰かに勧めたい')).toBeInTheDocument();
    expect(screen.getByText('もう一度読みたい')).toBeInTheDocument();
    expect(screen.getByText('人生観が変わった')).toBeInTheDocument();
    expect(screen.getByText('夜更かしした')).toBeInTheDocument();

    // API emotion tags
    expect(screen.getByText('感動')).toBeInTheDocument();
    expect(screen.getByText('切ない')).toBeInTheDocument();

    // Should NOT have old before/after or intensity sliders
    expect(screen.queryByText('読む前')).not.toBeInTheDocument();
    expect(screen.queryByText('読んだ後')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();

    // Explanation text
    expect(screen.getByText(/当てはまるものをタップ/)).toBeInTheDocument();
  });

  it('should save mixed quick tags and emotion tags', async () => {
    await renderAfterword();
    fireEvent.click(screen.getByText('この作品にタグをつける'));

    // Select a quick tag and an emotion tag
    fireEvent.click(screen.getByText('誰かに勧めたい'));
    fireEvent.click(screen.getByText('感動'));
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      // Emotion tags go to addEmotionTags
      expect(mockApi.addEmotionTags).toHaveBeenCalledWith('work-1', [
        { tagId: 'tag-1', intensity: 3 },
      ]);
      // Quick tags go to saveStateChanges
      expect(mockApi.saveStateChanges).toHaveBeenCalledWith('work-1', [
        { axis: 'recommend', before: 5, after: 8 },
      ]);
    });
    expect(screen.getByText('保存しました')).toBeInTheDocument();
  });

  // ---- AI Insights ----

  it('should lazy-load AI insights when section is opened', async () => {
    mockApi.getAiInsights.mockResolvedValue({
      data: {
        themes: [{ name: 'テーマ1', explanation: '説明1' }],
        emotionalJourney: '感情の旅路テスト',
        characterInsights: [],
      },
    });
    await renderAfterword();
    // Should not fetch yet
    expect(mockApi.getAiInsights).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('AIインサイトを見る'));
    await waitFor(() => {
      expect(mockApi.getAiInsights).toHaveBeenCalledWith('work-1');
    });
  });

  // ---- Navigation ----

  it('should have both work page and bookshelf links', async () => {
    await renderAfterword();
    const workLink = screen.getByText('作品ページ').closest('a');
    const bookshelfLink = screen.getByText('本棚へ戻る').closest('a');
    expect(workLink?.getAttribute('href')).toBe('/works/work-1');
    expect(bookshelfLink?.getAttribute('href')).toBe('/bookshelf');
  });

  // ---- Share ----

  it('should open share window with correct URL', async () => {
    const openSpy = vi.fn();
    globalThis.open = openSpy;

    await renderAfterword();
    fireEvent.click(screen.getByText('シェア'));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('x.com/intent/tweet');
    expect(url).toContain(encodeURIComponent('テスト作品'));
  });

  // ---- Recommendations ----

  it('should show recommendations when available', async () => {
    mockApi.getAiRecommendationsBecauseYouRead.mockResolvedValue({
      data: [
        { work: { id: 'rec-1', title: 'おすすめ作品' }, reason: '似ているから' },
      ],
    });
    await renderAfterword();
    await waitFor(() => {
      expect(screen.getByText('この作品が好きなら')).toBeInTheDocument();
    });
    expect(screen.getByTestId('rec-card')).toBeInTheDocument();
  });

  it('should not show recommendations section when empty', async () => {
    await renderAfterword();
    expect(screen.queryByText('この作品が好きなら')).not.toBeInTheDocument();
  });
});
