'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { api, type LetterType } from '@/lib/api';
import { Mail, Gift, Star, Zap } from 'lucide-react';

const LETTER_TYPES: {
  type: LetterType;
  label: string;
  price: string;
  maxChars: number;
  icon: React.ReactNode;
  description: string;
  color: string;
}[] = [
  {
    type: 'SHORT',
    label: 'ショートレター',
    price: '¥120',
    maxChars: 140,
    icon: <Zap className="h-4 w-4" />,
    description: 'ひとこと応援',
    color: 'border-blue-200 bg-blue-50 dark:bg-blue-950/30',
  },
  {
    type: 'STANDARD',
    label: 'レター',
    price: '¥300',
    maxChars: 500,
    icon: <Mail className="h-4 w-4" />,
    description: 'しっかり感想を伝える',
    color: 'border-green-200 bg-green-50 dark:bg-green-950/30',
  },
  {
    type: 'PREMIUM',
    label: 'プレミアムレター',
    price: '¥500',
    maxChars: 1000,
    icon: <Star className="h-4 w-4" />,
    description: 'ハイライト表示付き',
    color: 'border-purple-200 bg-purple-50 dark:bg-purple-950/30',
  },
  {
    type: 'GIFT',
    label: 'ギフトレター',
    price: '¥1,000〜',
    maxChars: 1000,
    icon: <Gift className="h-4 w-4" />,
    description: '特別な応援を届ける',
    color: 'border-amber-200 bg-amber-50 dark:bg-amber-950/30',
  },
];

interface LetterComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string;
  onSent: () => void;
}

export function LetterComposeDialog({
  open,
  onOpenChange,
  episodeId,
  onSent,
}: LetterComposeDialogProps) {
  const [step, setStep] = useState<'type' | 'compose'>('type');
  const [selectedType, setSelectedType] = useState<LetterType | null>(null);
  const [content, setContent] = useState('');
  const [giftAmount, setGiftAmount] = useState(1000);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep('type');
      setSelectedType(null);
      setContent('');
      setGiftAmount(1000);
      setError('');
    }
  }, [open]);

  const config = selectedType
    ? LETTER_TYPES.find((t) => t.type === selectedType)
    : null;

  async function handleSend() {
    if (!selectedType || !content.trim()) return;
    setSending(true);
    setError('');
    try {
      const { checkoutUrl } = await api.createLetterCheckout({
        episodeId,
        type: selectedType,
        content: content.trim(),
        giftAmount: selectedType === 'GIFT' ? giftAmount : undefined,
      });
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'レターの送信に失敗しました');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>
          {step === 'type' ? 'レターを書く' : `${config?.label}`}
        </DialogTitle>
      </DialogHeader>
      <DialogContent>
        {step === 'type' ? (
          <div className="grid grid-cols-2 gap-2">
            {LETTER_TYPES.map((lt) => (
              <button
                key={lt.type}
                onClick={() => {
                  setSelectedType(lt.type);
                  setStep('compose');
                }}
                className={`p-3 rounded-lg border text-left transition-colors hover:ring-2 hover:ring-primary/50 ${lt.color}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {lt.icon}
                  <span className="text-sm font-medium">{lt.label}</span>
                </div>
                <div className="text-xs text-muted-foreground">{lt.description}</div>
                <div className="text-xs font-medium mt-1">{lt.price}</div>
              </button>
            ))}
          </div>
        ) : config ? (
          <div className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="著者へのメッセージを書いてください..."
              className="w-full min-h-[120px] p-3 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={config.maxChars}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{content.length} / {config.maxChars}文字</span>
              <span>
                {selectedType === 'GIFT'
                  ? `¥${giftAmount.toLocaleString()}`
                  : config.price}
              </span>
            </div>
            {selectedType === 'GIFT' && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">金額</label>
                <input
                  type="number"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(Math.max(1000, Number(e.target.value)))}
                  min={1000}
                  step={100}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                />
              </div>
            )}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
      <DialogFooter>
        {step === 'compose' && (
          <>
            <Button variant="outline" size="sm" onClick={() => setStep('type')}>
              戻る
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !content.trim()}
            >
              {sending ? '送信中...' : 'レターを送る'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
