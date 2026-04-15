'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Heart, Bookmark } from 'lucide-react';
import type { WorldFragment, WishType } from '@/lib/world-fragments-api';

const WISH_TYPES: { value: WishType; label: string }[] = [
  { value: 'MOMENT', label: '描かれなかった一瞬' },
  { value: 'PERSPECTIVE', label: '別の視点' },
  { value: 'SIDE_STORY', label: '裏側の物語' },
  { value: 'WHAT_IF', label: 'もしも' },
];

const QUALITY_LABELS: Record<string, string> = {
  characterConsistency: 'キャラクター一貫性',
  worldCoherence: '世界整合性',
  literaryQuality: '文学的品質',
  wishFulfillment: '願い充足度',
};

interface FragmentReadDialogProps {
  fragment: WorldFragment | null;
  onClose: () => void;
  onApplause: (id: string) => void;
  onBookmark: (id: string) => void;
  onDelete?: (id: string) => void;
  currentUserId?: string;
}

export function FragmentReadDialog({
  fragment,
  onClose,
  onApplause,
  onBookmark,
  onDelete,
  currentUserId,
}: FragmentReadDialogProps) {
  if (!fragment || !fragment.content) return null;

  const wishTypeInfo = WISH_TYPES.find((wt) => wt.value === fragment.wishType);

  return (
    <Dialog open={!!fragment} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Badge variant="outline" className="font-normal text-xs">
              {wishTypeInfo?.label ?? fragment.wishType}
            </Badge>
            <p className="text-sm text-muted-foreground italic">
              &ldquo;{fragment.wish}&rdquo;
            </p>
            {fragment.scope && (
              <p className="text-xs text-muted-foreground">
                第{fragment.scope.upToEpisode}話まで
              </p>
            )}
          </div>
        </div>
      </DialogHeader>

      <DialogContent>
        {/* Generated Content */}
        <div
          className="font-serif text-sm leading-[2] tracking-wide whitespace-pre-wrap max-w-[640px] mx-auto"
        >
          {fragment.content}
        </div>

        {/* Quality Score */}
        {fragment.qualityScore && (
          <div className="grid grid-cols-4 gap-2 text-xs text-center mt-4">
            {(['characterConsistency', 'worldCoherence', 'literaryQuality', 'wishFulfillment'] as const).map((key) => (
              <div key={key} className="rounded-md bg-secondary/50 p-2">
                <div className="font-medium text-foreground">
                  {(fragment.qualityScore as any)?.[key] ?? '-'}
                </div>
                <div className="text-muted-foreground">{QUALITY_LABELS[key]}</div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {fragment.contentMeta && (
              <>
                <span>{fragment.contentMeta.wordCount.toLocaleString()}字</span>
                <span>約{fragment.contentMeta.estimatedReadTime}分</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onApplause(fragment.id)}
              className={fragment.hasApplauded ? 'text-primary' : ''}
            >
              <Heart className={`w-4 h-4 mr-1 ${fragment.hasApplauded ? 'fill-current' : ''}`} />
              {fragment.applauseCount}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBookmark(fragment.id)}
              className={fragment.hasBookmarked ? 'text-primary' : ''}
            >
              <Bookmark className={`w-4 h-4 ${fragment.hasBookmarked ? 'fill-current' : ''}`} />
            </Button>
            {currentUserId && currentUserId === fragment.requesterId && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('この断片を削除しますか？')) {
                    onDelete(fragment.id);
                  }
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                削除
              </Button>
            )}
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
