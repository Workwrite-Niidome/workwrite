import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'current-user' } }),
}));

vi.mock('./post-actions', () => ({
  PostActions: () => <div data-testid="post-actions" />,
}));

vi.mock('./work-embed', () => ({
  WorkEmbed: () => <div data-testid="work-embed" />,
}));

vi.mock('lucide-react', () => ({
  Repeat2: (props: any) => <svg data-testid="icon-repeat" {...props} />,
  Trash2: (props: any) => <svg data-testid="icon-trash" {...props} />,
}));

import { PostCard } from './post-card';
import type { SnsPost } from '@/lib/api';

function makePost(overrides: Partial<SnsPost> = {}): SnsPost {
  return {
    id: 'post-1',
    content: 'Hello world',
    postType: 'ORIGINAL',
    authorId: 'user-1',
    author: {
      id: 'user-1',
      name: 'testuser',
      displayName: 'Test User',
      avatarUrl: null,
      role: 'USER',
    },
    createdAt: new Date().toISOString(),
    replyCount: 0,
    repostCount: 0,
    applauseCount: 0,
    bookmarkCount: 0,
    hasApplauded: false,
    hasBookmarked: false,
    hasReposted: false,
    ...overrides,
  } as SnsPost;
}

describe('PostCard', () => {
  describe('content truncation', () => {
    it('should show full text when content is 140 chars or fewer', () => {
      const shortContent = 'A'.repeat(140);
      render(<PostCard post={makePost({ content: shortContent })} />);

      expect(screen.getByText(shortContent)).toBeInTheDocument();
      expect(screen.queryByText('続きを読む')).not.toBeInTheDocument();
    });

    it('should truncate content longer than 140 chars with ellipsis', () => {
      const longContent = 'A'.repeat(200);
      render(<PostCard post={makePost({ content: longContent })} />);

      // Should show truncated text (140 chars + ...)
      expect(screen.getByText('A'.repeat(140) + '...')).toBeInTheDocument();
      expect(screen.getByText('続きを読む')).toBeInTheDocument();
    });

    it('should expand content when 続きを読む is clicked', () => {
      const longContent = 'A'.repeat(200);
      render(<PostCard post={makePost({ content: longContent })} />);

      fireEvent.click(screen.getByText('続きを読む'));

      expect(screen.getByText(longContent)).toBeInTheDocument();
      expect(screen.queryByText('続きを読む')).not.toBeInTheDocument();
    });
  });

  describe('author display', () => {
    it('should show displayName when available', () => {
      render(<PostCard post={makePost()} />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
    });

    it('should show name when displayName is null', () => {
      render(<PostCard post={makePost({
        author: { id: 'u-1', name: 'fallback', displayName: null, avatarUrl: null, role: 'USER' },
      })} />);

      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('should show avatar initial when no avatarUrl', () => {
      render(<PostCard post={makePost()} />);

      // First letter of displayName
      expect(screen.getByText('T')).toBeInTheDocument();
    });
  });

  describe('delete button', () => {
    it('should show delete button for own posts when onDelete is provided', () => {
      const onDelete = vi.fn();
      render(<PostCard post={makePost({ authorId: 'current-user' })} onDelete={onDelete} />);

      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('should not show delete button for other users posts', () => {
      const onDelete = vi.fn();
      render(<PostCard post={makePost({ authorId: 'other-user' })} onDelete={onDelete} />);

      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });
  });

  describe('repost display', () => {
    it('should show repost indicator for REPOST type', () => {
      const repostPost = makePost({
        postType: 'REPOST',
        repostOf: makePost({ id: 'original-1', content: 'Original content' }),
      });
      render(<PostCard post={repostPost} />);

      expect(screen.getByText(/おすすめ/)).toBeInTheDocument();
      expect(screen.getByText('Original content')).toBeInTheDocument();
    });
  });

  describe('work embed', () => {
    it('should show work embed when post has work', () => {
      render(<PostCard post={makePost({ work: { id: 'w-1', title: 'Test Work' } as any })} />);

      expect(screen.getByTestId('work-embed')).toBeInTheDocument();
    });
  });
});
