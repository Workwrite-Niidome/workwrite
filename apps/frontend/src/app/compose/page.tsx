'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const MAX_LENGTH = 500;

export default function ComposePage() {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isAuthenticated) {
    router.replace('/login');
    return null;
  }

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await api.createPost({ content: content.trim() });
      router.push('/timeline');
    } catch (e: any) {
      alert(e.message || '投稿に失敗しました');
      setPosting(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const remaining = MAX_LENGTH - content.length;
  const displayName = user?.displayName || user?.name || '';

  return (
    <div className="w-full md:mx-auto md:max-w-2xl min-h-screen">
      {/* Header */}
      <div className="sticky top-12 z-40 bg-background border-b border-border flex items-center justify-between px-4 py-2">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Button
          size="sm"
          onClick={handlePost}
          disabled={!content.trim() || posting || remaining < 0}
          className="h-8 px-4 text-xs"
        >
          {posting ? '投稿中...' : '投稿する'}
        </Button>
      </div>

      {/* Composer */}
      <div className="px-4 py-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
            {displayName[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleInput}
              placeholder="いまどうしてる？"
              maxLength={MAX_LENGTH}
              rows={4}
              autoFocus
              className="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-h-[6rem]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handlePost();
                }
              }}
            />
            <div className="flex items-center justify-end mt-2">
              {content.length > 0 && (
                <span className={`text-xs ${remaining < 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {remaining}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
