'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CornerDownRight } from 'lucide-react';
import { api, SnsPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PostCard, PostCardSkeleton } from '@/components/posts/post-card';
import { PostComposer } from '@/components/posts/post-composer';
import { PostActions } from '@/components/posts/post-actions';
import { WorkEmbed } from '@/components/posts/work-embed';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ReplyNode {
  post: SnsPost;
  children: ReplyNode[];
  depth: number;
}

function buildReplyTree(rootPostId: string, replies: SnsPost[]): ReplyNode[] {
  const childrenMap = new Map<string, SnsPost[]>();

  for (const reply of replies) {
    const parentId = reply.replyToId || rootPostId;
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(reply);
  }

  function buildNodes(parentId: string, depth: number): ReplyNode[] {
    const children = childrenMap.get(parentId) || [];
    return children.map((post) => ({
      post,
      children: buildNodes(post.id, depth + 1),
      depth,
    }));
  }

  return buildNodes(rootPostId, 0);
}

const MAX_VISUAL_DEPTH = 3;

function ReplyTreeNode({
  node,
  onDelete,
  onReply,
  replyingTo,
  onPost,
}: {
  node: ReplyNode;
  onDelete: (id: string) => void;
  onReply: (postId: string) => void;
  replyingTo: string | null;
  onPost: () => void;
}) {
  const visualDepth = Math.min(node.depth, MAX_VISUAL_DEPTH);
  const indent = visualDepth > 0;
  const replyToName = node.post.replyTo?.author?.displayName || node.post.replyTo?.author?.name;

  return (
    <div>
      <div className={cn(indent && 'ml-4 md:ml-8 border-l-2 border-muted')}>
        {/* Show reply target if nested reply */}
        {node.depth > 0 && replyToName && node.post.replyToId !== node.post.threadRootId && (
          <div className="flex items-center gap-1 px-4 pt-1.5 text-xs text-muted-foreground">
            <CornerDownRight className="h-3 w-3" />
            <span>{replyToName} への返信</span>
          </div>
        )}
        <PostCard
          post={node.post}
          onDelete={onDelete}
          onReplyClick={() => onReply(node.post.id)}
        />
        {replyingTo === node.post.id && (
          <div className="border-b border-border">
            <PostComposer
              replyToId={node.post.id}
              compact
              onPost={onPost}
              placeholder={`${node.post.author.displayName || node.post.author.name} に返信...`}
            />
          </div>
        )}
      </div>
      {node.children.map((child) => (
        <ReplyTreeNode
          key={child.post.id}
          node={child}
          onDelete={onDelete}
          onReply={onReply}
          replyingTo={replyingTo}
          onPost={onPost}
        />
      ))}
    </div>
  );
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [post, setPost] = useState<SnsPost | null>(null);
  const [replies, setReplies] = useState<SnsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyCursor, setReplyCursor] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const postId = params.id as string;

  const loadPost = useCallback(async () => {
    try {
      const [postRes, repliesRes] = await Promise.all([
        api.getPost(postId),
        api.getPostReplies(postId),
      ]);
      setPost(postRes.data);
      setReplies(repliesRes.data.posts);
      setReplyCursor(repliesRes.data.nextCursor);
      setReplyingTo(null);
    } catch {
      // Post not found
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const loadMoreReplies = async () => {
    if (!replyCursor) return;
    const res = await api.getPostReplies(postId, replyCursor);
    setReplies((prev) => [...prev, ...res.data.posts]);
    setReplyCursor(res.data.nextCursor);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePost(id);
      if (id === postId) {
        router.back();
      } else {
        setReplies((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      alert('削除に失敗しました');
    }
  };

  const handleReply = (targetPostId: string) => {
    setReplyingTo(replyingTo === targetPostId ? null : targetPostId);
  };

  const replyTree = useMemo(
    () => buildReplyTree(postId, replies),
    [postId, replies],
  );

  if (loading) {
    return (
      <main className="w-full md:mx-auto md:max-w-2xl min-h-screen">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium">ひとこと</h1>
        </div>
        <PostCardSkeleton />
      </main>
    );
  }

  if (!post) {
    return (
      <main className="w-full md:mx-auto md:max-w-2xl min-h-screen">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium">ひとこと</h1>
        </div>
        <div className="text-center py-12 text-muted-foreground text-sm">
          投稿が見つかりません
        </div>
      </main>
    );
  }

  const authorName = post.author.displayName || post.author.name;

  return (
    <main className="w-full md:mx-auto md:max-w-2xl min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border sticky top-12 z-40 bg-background">
        <button onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-medium">ひとこと</h1>
      </div>

      {/* Post detail (larger format) */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/users/${post.authorId}`}>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-base font-medium text-muted-foreground overflow-hidden">
              {post.author.avatarUrl ? (
                <img src={post.author.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                authorName[0]
              )}
            </div>
          </Link>
          <div>
            <Link href={`/users/${post.authorId}`} className="font-medium text-sm hover:underline">
              {authorName}
            </Link>
            <p className="text-xs text-muted-foreground">@{post.author.name}</p>
          </div>
        </div>

        <p className="text-base whitespace-pre-wrap break-words">
          {post.content}
        </p>

        {post.quoteOf && (
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium">
                {post.quoteOf.author?.displayName || post.quoteOf.author?.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {post.quoteOf.content}
            </p>
          </div>
        )}

        {post.work && <WorkEmbed work={post.work} />}

        <p className="text-xs text-muted-foreground mt-3">
          {formatFullDate(post.createdAt)}
        </p>

        {/* Stats */}
        {(post.repostCount > 0 || post.applauseCount > 0 || post.bookmarkCount > 0) && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs">
            {post.repostCount > 0 && (
              <span><strong>{post.repostCount}</strong> おすすめ</span>
            )}
            {post.applauseCount > 0 && (
              <span><strong>{post.applauseCount}</strong> 拍手</span>
            )}
            {post.bookmarkCount > 0 && (
              <span><strong>{post.bookmarkCount}</strong> しおり</span>
            )}
          </div>
        )}

        <div className="border-t border-border mt-3 pt-1">
          <PostActions post={post} />
        </div>
      </div>

      {/* Reply composer for root post */}
      {isAuthenticated && (
        <PostComposer
          replyToId={postId}
          compact
          onPost={loadPost}
        />
      )}

      {/* Replies - tree view */}
      {replyTree.map((node) => (
        <ReplyTreeNode
          key={node.post.id}
          node={node}
          onDelete={handleDelete}
          onReply={handleReply}
          replyingTo={replyingTo}
          onPost={loadPost}
        />
      ))}

      {replyCursor && (
        <button
          onClick={loadMoreReplies}
          className="w-full py-3 text-sm text-primary hover:bg-muted/50 transition-colors"
        >
          さらに表示
        </button>
      )}
    </main>
  );
}
