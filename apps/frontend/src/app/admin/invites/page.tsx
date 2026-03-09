'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { api, type InviteCode } from '@/lib/api';

export default function AdminInvitesPage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('10');
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await api.getInviteCodes();
      setCodes(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  async function handleCreate() {
    setCreating(true);
    try {
      await api.createInviteCode({
        label: newLabel || undefined,
        maxUses: parseInt(newMaxUses) || 10,
      });
      setNewLabel('');
      setNewMaxUses('10');
      fetchCodes();
    } catch {}
    setCreating(false);
  }

  async function handleToggle(id: string) {
    try {
      await api.toggleInviteCode(id);
      fetchCodes();
    } catch {}
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteInviteCode(deleteTarget);
      fetchCodes();
    } catch {}
    setDeleteTarget(null);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4">招待コード管理</h2>

      {/* Create new code */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6 p-4 border border-border rounded-lg bg-secondary/20">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="ラベル（例：SNS配布用）"
          className="flex-1"
        />
        <Input
          type="number"
          value={newMaxUses}
          onChange={(e) => setNewMaxUses(e.target.value)}
          placeholder="使用回数"
          className="w-24"
          min="1"
        />
        <Button onClick={handleCreate} disabled={creating} className="gap-1">
          <Plus className="h-4 w-4" />
          {creating ? '作成中...' : '作成'}
        </Button>
      </div>

      {/* Code list */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">コード</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">ラベル</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">使用数</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">状態</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">作成日</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    招待コードがまだありません
                  </td>
                </tr>
              ) : (
                codes.map((code) => (
                  <tr key={code.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="text-muted-foreground hover:text-foreground"
                          title="コピー"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {copied === code.code && (
                          <span className="text-xs text-green-600">copied</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {code.label || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={code.usedCount >= code.maxUses ? 'text-destructive' : ''}>
                        {code.usedCount} / {code.maxUses}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {code.isActive ? (
                        <span className="text-xs text-green-600 font-medium">有効</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">無効</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(code.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleToggle(code.id)}
                        >
                          {code.isActive ? (
                            <><ToggleRight className="h-3.5 w-3.5" /> 無効化</>
                          ) : (
                            <><ToggleLeft className="h-3.5 w-3.5" /> 有効化</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(code.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="招待コードを削除"
        message="この招待コードを削除しますか？削除すると元に戻せません。"
        confirmLabel="削除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
