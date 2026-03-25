'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Check, X, Shield } from 'lucide-react';

interface ModerationLetter {
  id: string;
  sender: { id: string; name: string; displayName?: string };
  recipient: { id: string; name: string; displayName?: string };
  episode: { id: string; title: string; work?: { id: string; title: string } };
  type: string;
  content: string;
  amount: number;
  moderationStatus: string;
  moderationReason?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

export default function AdminLettersPage() {
  const [letters, setLetters] = useState<ModerationLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [acting, setActing] = useState<string | null>(null);

  async function loadLetters() {
    setLoading(true);
    try {
      const res = await (api as any).request(`/admin/letters?status=${filter}`);
      setLetters(res.data || []);
    } catch {
      setLetters([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLetters();
  }, [filter]);

  async function handleModerate(id: string, action: 'approve' | 'reject') {
    setActing(id);
    try {
      await (api as any).request(`/admin/letters/${id}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      setLetters((prev) => prev.filter((l) => l.id !== id));
    } catch {
      // ignore
    }
    setActing(null);
  }

  return (
    <div className="px-4 py-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-5 w-5" />
        <h1 className="text-2xl font-bold">ギフトレターモデレーション</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected'].map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === 'pending' ? '保留中' : s === 'approved' ? '承認済み' : '拒否'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : letters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {filter === 'pending' ? '保留中のギフトレターはありません' : 'ギフトレターがありません'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <Card key={letter.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">
                    {letter.sender?.displayName || letter.sender?.name}
                  </span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm">
                    {letter.recipient?.displayName || letter.recipient?.name}
                  </span>
                  <Badge className={`text-[10px] ${STATUS_COLORS[letter.moderationStatus] || ''}`}>
                    {letter.moderationStatus}
                  </Badge>
                  {letter.amount > 0 && (
                    <span className="text-xs font-medium">¥{letter.amount.toLocaleString()}</span>
                  )}
                </div>
                <p className="text-sm mb-2 border-l-2 pl-3 border-muted">{letter.content}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {letter.episode?.work?.title} &gt; {letter.episode?.title}
                    {' · '}
                    {new Date(letter.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                  {letter.moderationStatus === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-green-600"
                        onClick={() => handleModerate(letter.id, 'approve')}
                        disabled={acting === letter.id}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> 承認
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600"
                        onClick={() => handleModerate(letter.id, 'reject')}
                        disabled={acting === letter.id}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> 拒否
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
