import { render, screen, fireEvent } from '@testing-library/react';
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

describe('EpisodeCompleteBanner', () => {
  it('should render the completion message', () => {
    render(<EpisodeCompleteBanner workId="w-1" />);

    expect(screen.getByText('この話はどうでしたか？')).toBeInTheDocument();
  });

  it('should show next episode button when nextEpisodeId is provided', () => {
    render(<EpisodeCompleteBanner workId="w-1" nextEpisodeId="ep-2" />);

    expect(screen.getByText('次話を読む')).toBeInTheDocument();
    expect(screen.getByText('ここまでにする')).toBeInTheDocument();
  });

  it('should show 読了 button when no next episode', () => {
    render(<EpisodeCompleteBanner workId="w-1" />);

    expect(screen.getByText('読了')).toBeInTheDocument();
    expect(screen.queryByText('次話を読む')).not.toBeInTheDocument();
  });

  it('should link to correct next episode URL', () => {
    render(<EpisodeCompleteBanner workId="w-1" nextEpisodeId="ep-2" />);

    const nextLink = screen.getByText('次話を読む').closest('a');
    expect(nextLink?.getAttribute('href')).toBe('/read/ep-2');
  });

  it('should link to afterword when no next episode', () => {
    render(<EpisodeCompleteBanner workId="w-1" />);

    const afterwordLink = screen.getByText('読了').closest('a');
    expect(afterwordLink?.getAttribute('href')).toBe('/works/w-1/afterword');
  });

  it('should render 5 reaction emoji buttons', () => {
    render(<EpisodeCompleteBanner workId="w-1" />);

    expect(screen.getByText('😢')).toBeInTheDocument();
    expect(screen.getByText('😊')).toBeInTheDocument();
    expect(screen.getByText('😲')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('🤔')).toBeInTheDocument();
  });

  it('should call onReaction when emoji button is clicked', () => {
    const onReaction = vi.fn();
    render(<EpisodeCompleteBanner workId="w-1" onReaction={onReaction} />);

    fireEvent.click(screen.getByText('😢'));

    expect(onReaction).toHaveBeenCalledWith('😢');
  });

  it('should show reaction labels', () => {
    render(<EpisodeCompleteBanner workId="w-1" />);

    expect(screen.getByText('泣いた')).toBeInTheDocument();
    expect(screen.getByText('温かい')).toBeInTheDocument();
    expect(screen.getByText('驚いた')).toBeInTheDocument();
    expect(screen.getByText('燃えた')).toBeInTheDocument();
    expect(screen.getByText('考えた')).toBeInTheDocument();
  });
});
