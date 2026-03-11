'use client';

import { useState } from 'react';
import { MessageCircle, Repeat2, Heart, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, SnsPost } from '@/lib/api';

interface PostActionsProps {
  post: SnsPost;
  onReplyClick?: () => void;
}

export function PostActions({ post, onReplyClick }: PostActionsProps) {
  const [applauded, setApplauded] = useState(post.hasApplauded ?? false);
  const [applauseCount, setApplauseCount] = useState(post.applauseCount);
  const [reposted, setReposted] = useState(post.hasReposted ?? false);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [bookmarked, setBookmarked] = useState(post.hasBookmarked ?? false);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarkCount);

  const handleApplause = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (applauded) {
        setApplauded(false);
        setApplauseCount((c) => c - 1);
        await api.removeApplause(post.id);
      } else {
        setApplauded(true);
        setApplauseCount((c) => c + 1);
        await api.applaudPost(post.id);
      }
    } catch {
      setApplauded(!applauded);
      setApplauseCount(post.applauseCount);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (reposted) {
        setReposted(false);
        setRepostCount((c) => c - 1);
        await api.removeRepost(post.id);
      } else {
        setReposted(true);
        setRepostCount((c) => c + 1);
        await api.repostPost(post.id);
      }
    } catch {
      setReposted(!reposted);
      setRepostCount(post.repostCount);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (bookmarked) {
        setBookmarked(false);
        setBookmarkCount((c) => c - 1);
        await api.removePostBookmark(post.id);
      } else {
        setBookmarked(true);
        setBookmarkCount((c) => c + 1);
        await api.bookmarkPost(post.id);
      }
    } catch {
      setBookmarked(!bookmarked);
      setBookmarkCount(post.bookmarkCount);
    }
  };

  const handleReply = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onReplyClick?.();
  };

  return (
    <div className="flex items-center gap-6 mt-3">
      {/* Reply */}
      <button
        onClick={handleReply}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors group"
      >
        <MessageCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
        {post.replyCount > 0 && <span className="text-xs">{post.replyCount}</span>}
      </button>

      {/* Repost */}
      <button
        onClick={handleRepost}
        className={cn(
          'flex items-center gap-1.5 transition-colors group',
          reposted ? 'text-green-600' : 'text-muted-foreground hover:text-green-600',
        )}
      >
        <Repeat2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
        {repostCount > 0 && <span className="text-xs">{repostCount}</span>}
      </button>

      {/* Applause (Heart) */}
      <button
        onClick={handleApplause}
        className={cn(
          'flex items-center gap-1.5 transition-colors group',
          applauded ? 'text-red-500' : 'text-muted-foreground hover:text-red-500',
        )}
      >
        <Heart
          className={cn(
            'h-4 w-4 group-hover:scale-110 transition-transform',
            applauded && 'fill-red-500',
          )}
        />
        {applauseCount > 0 && <span className="text-xs">{applauseCount}</span>}
      </button>

      {/* Bookmark */}
      <button
        onClick={handleBookmark}
        className={cn(
          'flex items-center gap-1.5 transition-colors group',
          bookmarked ? 'text-primary' : 'text-muted-foreground hover:text-primary',
        )}
      >
        <Bookmark
          className={cn(
            'h-4 w-4 group-hover:scale-110 transition-transform',
            bookmarked && 'fill-primary',
          )}
        />
        {bookmarkCount > 0 && <span className="text-xs">{bookmarkCount}</span>}
      </button>
    </div>
  );
}
