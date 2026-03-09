'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { api, type EpisodeSnapshot } from '@/lib/api';
import { History, RotateCcw, Eye, X } from 'lucide-react';

interface VersionHistoryPanelProps {
  episodeId: string;
  onRestore: (title: string, content: string) => void;
  onClose: () => void;
}

export function VersionHistoryPanel({ episodeId, onRestore, onClose }: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<EpisodeSnapshot[]>([]);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSnapshots(episodeId)
      .then((res) => setSnapshots(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [episodeId]);

  async function handlePreview(snapshotId: string) {
    try {
      const res = await api.getSnapshotContent(snapshotId);
      setPreview({ title: res.data.title, content: res.data.content });
    } catch {}
  }

  async function handleRestore() {
    if (!restoreId) return;
    try {
      const res = await api.restoreSnapshot(restoreId);
      onRestore(res.data.title, res.data.content);
    } catch {}
    setRestoreId(null);
  }

  async function handleCreateSnapshot() {
    try {
      await api.createSnapshot(episodeId, 'Manual save');
      const res = await api.getSnapshots(episodeId);
      setSnapshots(res.data);
    } catch {}
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> バージョン履歴
        </h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={handleCreateSnapshot} className="text-xs h-7">
            保存
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">読み込み中...</p>
        ) : snapshots.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">バージョン履歴がありません</p>
        ) : (
          <ul className="divide-y">
            {snapshots.map((s) => (
              <li key={s.id} className="p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate">{s.label || s.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(s.createdAt).toLocaleString('ja-JP', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{s.wordCount.toLocaleString()} 文字</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePreview(s.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                    >
                      <Eye className="h-3 w-3" /> 表示
                    </button>
                    <button
                      onClick={() => setRestoreId(s.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                    >
                      <RotateCcw className="h-3 w-3" /> 復元
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-background rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-medium">{preview.title}</h4>
              <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] whitespace-pre-wrap text-sm leading-relaxed"
              style={{ fontFamily: '"Noto Serif JP", "游明朝", serif' }}
            >
              {preview.content}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!restoreId}
        onOpenChange={(v) => { if (!v) setRestoreId(null); }}
        title="バージョンを復元"
        message="現在の内容を上書きしてこのバージョンを復元しますか？現在の内容は自動的にスナップショットとして保存されます。"
        confirmLabel="復元する"
        variant="default"
        onConfirm={handleRestore}
      />
    </div>
  );
}
