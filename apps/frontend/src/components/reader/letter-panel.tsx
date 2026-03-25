'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { api, type Letter } from '@/lib/api';
import { Mail, Gift, Star, Zap, PenLine } from 'lucide-react';
import { LetterComposeDialog } from './letter-compose-dialog';

const TYPE_STYLES: Record<string, { icon: React.ReactNode; badge: string; badgeClass: string }> = {
  SHORT: {
    icon: <Zap className="h-3 w-3" />,
    badge: 'ショート',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  STANDARD: {
    icon: <Mail className="h-3 w-3" />,
    badge: 'レター',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  PREMIUM: {
    icon: <Star className="h-3 w-3" />,
    badge: 'プレミアム',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
  GIFT: {
    icon: <Gift className="h-3 w-3" />,
    badge: 'ギフト',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
};

interface LetterPanelProps {
  episodeId: string;
  isAuthenticated: boolean;
  /** When provided, compose dialog is handled externally (e.g. at page level to avoid BottomSheet nesting issues) */
  onCompose?: () => void;
  /** Called when letters should be reloaded (e.g. after send) */
  reloadKey?: number;
}

export function LetterPanel({ episodeId, isAuthenticated, onCompose, reloadKey }: LetterPanelProps) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  function loadLetters() {
    setLoading(true);
    api.getLettersForEpisode(episodeId)
      .then((res) => setLetters(Array.isArray(res) ? res : []))
      .catch(() => setLetters([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLetters();
  }, [episodeId, reloadKey]);

  function renderLetter(letter: Letter) {
    const style = TYPE_STYLES[letter.type] || TYPE_STYLES.STANDARD;
    const isGift = letter.type === 'GIFT';
    const isHighlighted = letter.isHighlighted;

    return (
      <div
        key={letter.id}
        className={`rounded-lg border p-3 space-y-2 ${
          isHighlighted
            ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700'
            : 'border-border'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${style.badgeClass}`}>
            {style.icon}
            {style.badge}
          </span>
          {letter.amount > 0 && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              ¥{letter.amount.toLocaleString()}
            </span>
          )}
          {letter.isFreeQuota && (
            <span className="text-[10px] text-muted-foreground">無料</span>
          )}
        </div>
        <p className="text-sm leading-relaxed">{letter.content}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">
            {letter.sender.displayName || letter.sender.name}
          </span>
          <span>{new Date(letter.createdAt).toLocaleDateString('ja-JP')}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">読み込み中...</div>
        ) : letters.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Mail className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              まだレターはありません
            </p>
            <p className="text-xs text-muted-foreground">
              著者に感想を届けましょう
            </p>
          </div>
        ) : (
          letters.map(renderLetter)
        )}
      </div>
      {isAuthenticated && (
        <div className="p-4 border-t border-border">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => onCompose ? onCompose() : setShowCompose(true)}
          >
            <PenLine className="h-3.5 w-3.5" />
            レターを書く
          </Button>
        </div>
      )}
      {/* Only render dialog here when no external handler (desktop sidebar case) */}
      {!onCompose && (
        <LetterComposeDialog
          open={showCompose}
          onOpenChange={setShowCompose}
          episodeId={episodeId}
          onSent={loadLetters}
        />
      )}
    </>
  );
}
