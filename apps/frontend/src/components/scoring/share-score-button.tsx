'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Check } from 'lucide-react';

interface ShareScoreButtonProps {
  workId: string;
  title: string;
  score: number;
  variant?: 'compact' | 'prominent';
}

function getShareText(title: string, score: number): string {
  const s = Math.round(score);
  if (s >= 90) return `AIが「傑作」と判定！「${title}」のAI品質スコア: ${s}/100\nあなたの作品は何点？ 無料で診断 →`;
  if (s >= 80) return `「${title}」がAI品質スコア${s}点の「秀作」判定！\nあなたの小説も無料で診断できます →`;
  if (s >= 65) return `「${title}」のAI品質スコアは${s}点（良作）でした。\n改善提案も具体的で面白い。あなたも試してみて →`;
  if (s >= 50) return `AI品質分析やってみた。「${title}」は${s}点。\n改善ポイントが具体的で参考になる →`;
  return `「${title}」をAI品質分析してみた（${s}点）。\n自分の作品の強みと課題が見えて面白い →`;
}

export function ShareScoreButton({ workId, title, score, variant = 'compact' }: ShareScoreButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const workUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/works/${workId}`
    : `/works/${workId}`;

  const shareText = getShareText(title, score);
  const hashtags = '#Workwrite #小説書きさんと繋がりたい';

  function shareToX() {
    const tweetText = `${shareText}\n${workUrl}\n${hashtags}`;
    const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(intentUrl, '_blank', 'width=550,height=420');
  }

  function shareToLine() {
    const lineText = `${shareText}\n${workUrl}`;
    window.open(`https://line.me/R/share?text=${encodeURIComponent(lineText)}`, '_blank');
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

  if (variant === 'prominent') {
    return (
      <div className="space-y-2">
        <Button onClick={shareToX} className="w-full gap-2" size="lg">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          X (Twitter) でシェア
        </Button>
        <div className="flex gap-2">
          <Button onClick={shareToLine} variant="outline" className="flex-1 gap-2" size="sm">
            LINE
          </Button>
          <Button onClick={copyUrl} variant="outline" className="flex-1 gap-2" size="sm">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'コピー済み' : 'URLコピー'}
          </Button>
        </div>
      </div>
    );
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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 right-0 z-50 bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[150px]">
            <button
              onClick={() => { shareToX(); setOpen(false); }}
              className="w-full text-left text-xs font-medium px-3 py-2 rounded-md hover:bg-secondary transition-colors flex items-center gap-2"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X (Twitter)
            </button>
            <button
              onClick={() => { shareToLine(); setOpen(false); }}
              className="w-full text-left text-xs font-medium px-3 py-2 rounded-md hover:bg-secondary transition-colors flex items-center gap-2"
            >
              LINE
            </button>
            <button
              onClick={() => { copyUrl(); setOpen(false); }}
              className="w-full text-left text-xs font-medium px-3 py-2 rounded-md hover:bg-secondary transition-colors flex items-center gap-2"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              URLコピー
            </button>
          </div>
        </>
      )}
    </div>
  );
}
