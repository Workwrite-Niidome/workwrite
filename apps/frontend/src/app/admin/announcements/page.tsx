'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type Announcement } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Plus, Pin, Bell, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

const CATEGORIES = [
  { value: 'update', label: 'アップデート' },
  { value: 'maintenance', label: 'メンテナンス' },
  { value: 'feature', label: '新機能' },
  { value: 'event', label: 'イベント' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  update: 'アップデート',
  maintenance: 'メンテナンス',
  feature: '新機能',
  event: 'イベント',
};

const CATEGORY_COLORS: Record<string, string> = {
  update: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  maintenance: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  feature: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  event: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

interface FormData {
  title: string;
  content: string;
  category: string;
  notifyAll: boolean;
  isPinned: boolean;
}

const emptyForm: FormData = {
  title: '',
  content: '',
  category: 'update',
  notifyAll: false,
  isPinned: false,
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAnnouncements();
      setAnnouncements(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  function handleNew() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function handleEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      notifyAll: a.notifyAll,
      isPinned: a.isPinned,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await api.updateAnnouncement(editingId, form);
      } else {
        await api.createAnnouncement(form);
      }
      setFormOpen(false);
      fetchAnnouncements();
    } catch {}
    setSaving(false);
  }

  async function handlePublish(id: string) {
    try {
      await api.publishAnnouncement(id);
      fetchAnnouncements();
    } catch (e) {
      alert(`公開に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}`);
    }
  }

  async function handleUnpublish(id: string) {
    try {
      await api.unpublishAnnouncement(id);
      fetchAnnouncements();
    } catch (e) {
      alert(`非公開にできませんでした: ${e instanceof Error ? e.message : '不明なエラー'}`);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteAnnouncement(deleteTarget.id);
      fetchAnnouncements();
    } catch {}
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
          お知らせ管理
        </h2>
        <Button size="sm" className="text-xs gap-1" onClick={handleNew}>
          <Plus className="h-3.5 w-3.5" />
          新規作成
        </Button>
      </div>

      {/* List */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider min-w-[240px]">タイトル</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">カテゴリ</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">作成日</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : announcements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    お知らせはまだありません
                  </td>
                </tr>
              ) : (
                announcements.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                        {a.notifyAll && <Bell className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
                        <span className="font-medium truncate max-w-[200px]">{a.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {CATEGORY_LABELS[a.category] || a.category}
                    </td>
                    <td className="px-4 py-3">
                      {a.isPublished ? (
                        <Badge variant="default" className="text-[10px]">公開中</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">下書き</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => handleEdit(a)}>
                          <Pencil className="h-3 w-3" /> 編集
                        </Button>
                        {a.isPublished ? (
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => handleUnpublish(a.id)}>
                            <EyeOff className="h-3 w-3" /> 非公開
                          </Button>
                        ) : (
                          <Button size="sm" className="h-7 px-3 text-xs gap-1" onClick={() => handlePublish(a.id)}>
                            <Eye className="h-3 w-3" /> 公開
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget(a)}>
                          <Trash2 className="h-3 w-3" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogHeader>
          <DialogTitle>{editingId ? 'お知らせを編集' : '新しいお知らせ'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">タイトル</label>
            <input
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="お知らせのタイトル"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">内容</label>
            <textarea
              className="w-full min-h-[120px] rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="お知らせの内容を入力..."
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">カテゴリ</label>
            <select
              className="w-full h-10 rounded-lg border border-border bg-transparent px-3 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.notifyAll}
                onChange={(e) => setForm({ ...form, notifyAll: e.target.checked })}
                className="rounded border-border"
              />
              全員に通知する
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                className="rounded border-border"
              />
              ピン留め
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}>
            {saving ? '保存中...' : editingId ? '更新' : '作成'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="お知らせを削除"
        message={`「${deleteTarget?.title}」を削除しますか？この操作は取り消せません。`}
        confirmLabel="削除"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
