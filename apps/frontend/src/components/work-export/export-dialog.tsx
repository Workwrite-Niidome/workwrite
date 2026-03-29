'use client';

import { useState } from 'react';
import { Download, FileText, BookOpen, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';

type ExportFormat = 'txt' | 'epub' | 'html';

const formats: { value: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'txt', label: 'テキスト (.txt)', desc: 'プレーンテキスト。他のエディタで開けます', icon: <FileText className="h-5 w-5" /> },
  { value: 'epub', label: 'EPUB (.epub)', desc: '電子書籍リーダー・Kindle向け', icon: <BookOpen className="h-5 w-5" /> },
  { value: 'html', label: 'HTML (.html)', desc: 'ブラウザで閲覧・印刷用', icon: <Globe className="h-5 w-5" /> },
];

interface ExportDialogProps {
  workId: string;
  workTitle: string;
}

export function ExportDialog({ workId, workTitle }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setLoading(true);
    setError('');
    try {
      await api.exportWork(workId, format, includeDrafts);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || 'エクスポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4 mr-1" /> エクスポート
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>作品をエクスポート</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          『{workTitle}』を書き出します
        </p>

        {/* Format selection */}
        <div className="space-y-2">
          {formats.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                format === f.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className={`mt-0.5 ${format === f.value ? 'text-primary' : 'text-muted-foreground'}`}>
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Include drafts toggle */}
        <label className="flex items-center justify-between pt-3 cursor-pointer">
          <span className="text-sm">下書きエピソードも含める</span>
          <input
            type="checkbox"
            checked={includeDrafts}
            onChange={(e) => setIncludeDrafts(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
        </label>

        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}

        <Button onClick={handleExport} disabled={loading} className="w-full mt-4">
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> エクスポート中...</>
          ) : (
            <><Download className="h-4 w-4 mr-2" /> ダウンロード</>
          )}
        </Button>
      </Dialog>
    </>
  );
}
