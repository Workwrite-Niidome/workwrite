import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EpisodeCompleteBanner } from './episode-complete-banner';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Droplets: (props: any) => <svg data-testid="icon-droplets" {...props} />,
  Heart: (props: any) => <svg data-testid="icon-heart" {...props} />,
  Zap: (props: any) => <svg data-testid="icon-zap" {...props} />,
  Flame: (props: any) => <svg data-testid="icon-flame" {...props} />,
  Brain: (props: any) => <svg data-testid="icon-brain" {...props} />,
  Hand: (props: any) => <svg data-testid="icon-hand" {...props} />,
}));

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    getEpisodeReactions: vi.fn().mockResolvedValue({ data: { totalClaps: 0, reactionCount: 0, emotions: {}, myReaction: null } }),
    sendReaction: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock auth
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

// Mock cn
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('EpisodeCompleteBanner', () => {
  it('should render the completion message', () => {
    render(<EpisodeCompleteBanner episodeId="ep-1" workId="w-1" />);
    expect(screen.getByText('この話はどうでしたか？')).toBeInTheDocument();
  });

  it('should show next episode button when nextEpisodeId is provided', () => {
    render(<EpisodeCompleteBanner episodeId="ep-1" workId="w-1" nextEpisodeId="ep-2" />);
    expect(screen.getByText('次話を読む')).toBeInTheDocument();
    expect(screen.getByText('ここまでにする')).toBeInTheDocument();
  });

  it('should show 読了 button when no next episode', () => {
    render(<EpisodeCompleteBanner episodeId="ep-1" workId="w-1" />);
    expect(screen.getByText('読了')).toBeInTheDocument();
    expect(screen.queryByText('次話を読む')).not.toBeInTheDocument();
  });

  it('should link to correct next episode URL', () => {
    render(<EpisodeCompleteBanner episodeId="ep-1" workId="w-1" nextEpisodeId="ep-2" />);
    const nextLink = screen.getByText('次話を読む').closest('a');
    expect(nextLink?.getAttribute('href')).toBe('/read/ep-2');
  });

  it('should link to afterword when no next episode', () => {
    render(<EpisodeCompleteBanner episodeId="ep-1" workId="w-1" />);
    const afterwordLink = screen.getByText('読了').closest('a');
    expect(afterwordLink?.getAttribute('href')).toBe('/works/w-1/afterword');
  });

  it('should render clap button', () => {
    render(<EpisodeCompleteBanner episodeId="ep-1" workId="w-1" />);
    expect(screen.getByText('拍手する')).toBeInTheDocument();
    expect(screen.getByTestId('icon-hand')).toBeInTheDocument();
  });
});
