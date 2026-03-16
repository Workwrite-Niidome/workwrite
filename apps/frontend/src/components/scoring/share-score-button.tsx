'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Check } from 'lucide-react';

interface ShareScoreButtonProps {
  workId: string;
  title: string;
  score: number;
}

export function ShareScoreButton({ workId, title, score }: ShareScoreButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const workUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/works/${workId}`
    : `/works/${workId}`;

  const shareText = `「${title}」のAI品質スコアは${Math.round(score)}点でした！ #Workwrite #小説分析`;

  function shareToX() {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(workUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  }

  function shareToLine() {
    const url = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(workUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${workUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="text-xs h-7 gap-1"
      >
        <Share2 className="h-3.5 w-3.5" />
        シェア
      </Button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 bg-popover border rounded-lg shadow-lg p-2 space-y-1 min-w-[140px]">
          <button
            onClick={() => { shareToX(); setOpen(false); }}
            className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-muted transition-colors"
          >
            X (Twitter)
          </button>
          <button
            onClick={() => { shareToLine(); setOpen(false); }}
            className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-muted transition-colors"
          >
            LINE
          </button>
          <button
            onClick={() => { copyUrl(); setOpen(false); }}
            className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            URLコピー
          </button>
        </div>
      )}
    </div>
  );
}
