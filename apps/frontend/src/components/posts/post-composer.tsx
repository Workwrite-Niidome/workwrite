'use client';

import { useState, useRef } from 'react';
import { BookOpen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface PostComposerProps {
  replyToId?: string;
  quoteOfId?: string;
  placeholder?: string;
  onPost?: () => void;
  compact?: boolean;
}

const MAX_LENGTH = 500;

export function PostComposer({ replyToId, quoteOfId, placeholder, onPost, compact }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isAuthenticated) return null;

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await api.createPost({
        content: content.trim(),
        replyToId,
        quoteOfId,
      });
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      onPost?.();
    } catch (e: any) {
      alert(e.message || '投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const remaining = MAX_LENGTH - content.length;
  const displayName = user?.displayName || user?.name || '';

  return (
    <div className={compact ? 'px-4 py-3 border-b border-border' : 'px-4 py-4 border-b border-border'}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
          {displayName[0] || 'U'}
        </div>

        {/* Input */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            placeholder={placeholder || (replyToId ? '返信を書く...' : 'いまどうしてる？')}
            maxLength={MAX_LENGTH}
            rows={compact ? 1 : 2}
            className="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-h-[2.5rem]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handlePost();
              }
            }}
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {/* Future: work/episode attach buttons */}
            </div>
            <div className="flex items-center gap-3">
              {content.length > 0 && (
                <span className={`text-xs ${remaining < 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {remaining}
                </span>
              )}
              <Button
                size="sm"
                onClick={handlePost}
                disabled={!content.trim() || posting || remaining < 0}
                className="h-8 px-4 text-xs"
              >
                {posting ? '投稿中...' : replyToId ? '返信' : '投稿'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
