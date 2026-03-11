'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Repeat2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SnsPost } from '@/lib/api';
import { PostActions } from './post-actions';
import { WorkEmbed } from './work-embed';
import { useAuth } from '@/lib/auth-context';

interface PostCardProps {
  post: SnsPost;
  onDelete?: (postId: string) => void;
  showReplyContext?: boolean;
}

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function getAutoPostLabel(postType: string): string | null {
  switch (postType) {
    case 'AUTO_WORK': return '作品を公開しました';
    case 'AUTO_EPISODE': return 'エピソードを公開しました';
    case 'AUTO_REVIEW': return 'レビューを投稿しました';
    case 'AUTO_READING': return '読了しました';
    default: return null;
  }
}

export function PostCard({ post, onDelete, showReplyContext }: PostCardProps) {
  const router = useRouter();
  const { user } = useAuth();

  // For REPOST type, show the original post with repost indicator
  if (post.postType === 'REPOST' && post.repostOf) {
    return (
      <div>
        <div className="flex items-center gap-1.5 px-4 pt-2 text-xs text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          <span>{post.author.displayName || post.author.name}さんがおすすめ</span>
        </div>
        <PostCard post={{ ...post.repostOf, hasApplauded: post.hasApplauded, hasBookmarked: post.hasBookmarked, hasReposted: true } as SnsPost} />
      </div>
    );
  }

  const autoLabel = getAutoPostLabel(post.postType);
  const authorName = post.author.displayName || post.author.name;

  const handleCardClick = () => {
    router.push(`/posts/${post.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(post.id);
  };

  return (
    <article
      onClick={handleCardClick}
      className="px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
    >
      {autoLabel && (
        <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-primary" />
          {autoLabel}
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <Link
          href={`/users/${post.authorId}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground overflow-hidden">
            {post.author.avatarUrl ? (
              <img src={post.author.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              authorName[0]
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/users/${post.authorId}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-sm hover:underline truncate"
            >
              {authorName}
            </Link>
            <span className="text-xs text-muted-foreground">
              @{post.author.name}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(post.createdAt)}
            </span>
            {user?.id === post.authorId && onDelete && (
              <button
                onClick={handleDelete}
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Post content */}
          {post.content && (
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">
              {post.content}
            </p>
          )}

          {/* Quote embed */}
          {post.quoteOf && (
            <div className="mt-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-medium">
                  {post.quoteOf.author?.displayName || post.quoteOf.author?.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  @{post.quoteOf.author?.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {post.quoteOf.content}
              </p>
            </div>
          )}

          {/* Work embed */}
          {post.work && <WorkEmbed work={post.work} />}

          {/* Actions */}
          <PostActions
            post={post}
            onReplyClick={() => router.push(`/posts/${post.id}`)}
          />
        </div>
      </div>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-border animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
        <div className="flex-1">
          <div className="flex gap-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
          <div className="h-4 w-full bg-muted rounded mt-2" />
          <div className="h-4 w-3/4 bg-muted rounded mt-1" />
          <div className="flex gap-6 mt-3">
            <div className="h-4 w-8 bg-muted rounded" />
            <div className="h-4 w-8 bg-muted rounded" />
            <div className="h-4 w-8 bg-muted rounded" />
            <div className="h-4 w-8 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
