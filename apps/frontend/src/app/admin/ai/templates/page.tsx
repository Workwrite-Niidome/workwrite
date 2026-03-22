'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  prompt: string;
  variables: string[];
  isBuiltIn: boolean;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM: Omit<Template, 'id' | 'isBuiltIn'> = {
  slug: '',
  name: '',
  description: '',
  category: 'writing',
  prompt: '',
  variables: [],
  isActive: true,
  sortOrder: 0,
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // id or 'new'
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const res = await api.getAdminTemplates();
      setTemplates(res.data);
    } catch {}
  }

  function startCreate() {
    setEditing('new');
    setForm(EMPTY_FORM);
  }

  function startEdit(t: Template) {
    setEditing(t.id);
    setForm({
      slug: t.slug,
      name: t.name,
      description: t.description || '',
      category: t.category,
      prompt: t.prompt,
      variables: t.variables,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      if (editing === 'new') {
        await api.createTemplate({
          ...form,
          variables: form.variables,
        });
      } else if (editing) {
        const { slug, ...updateData } = form;
      await api.updateTemplate(editing, updateData);
      }
      setEditing(null);
      await loadTemplates();
      setMessage('保存しました');
    } catch {
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmSeed, setConfirmSeed] = useState(false);

  async function handleDelete() {
    if (!confirmDeleteId) return;
    try {
      await api.deleteTemplate(confirmDeleteId);
      await loadTemplates();
    } catch {}
    setConfirmDeleteId(null);
  }

  async function handleSeed() {
    try {
      await api.seedTemplates();
      await loadTemplates();
      setMessage('テンプレートを再生成しました');
    } catch {
      setMessage('再生成に失敗しました');
    }
    setConfirmSeed(false);
  }

  const categoryLabel = (c: string) =>
    c === 'writing' ? '執筆' : c === 'editing' ? '編集' : c === 'generation' ? '生成' : c;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prompt Templates</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirmSeed(true)}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> デフォルト再生成
          </Button>
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> 新規作成
          </Button>
        </div>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}

      {/* Edit/Create form */}
      {editing && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Slug</label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="my-template"
                  disabled={editing !== 'new'}
                  className="mt-0.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium">名前</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="テンプレート名"
                  className="mt-0.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">カテゴリ</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-0.5 w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="writing">執筆</option>
                  <option value="editing">編集</option>
                  <option value="generation">生成</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">変数（カンマ区切り）</label>
                <Input
                  value={form.variables.join(', ')}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      variables: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                    })
                  }
                  placeholder="content, character_name"
                  className="mt-0.5"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">説明</label>
              <Input
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="テンプレートの説明"
                className="mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium">プロンプト</label>
              <Textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                rows={8}
                placeholder="プロンプト本文（{{content}} 等のプレースホルダが使えます）"
                className="mt-0.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                有効
              </label>
              <div className="flex items-center gap-1.5">
                <label className="text-xs">表示順</label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className="w-20 h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">名前</th>
              <th className="text-left px-4 py-2 font-medium">Slug</th>
              <th className="text-left px-4 py-2 font-medium">カテゴリ</th>
              <th className="text-left px-4 py-2 font-medium">状態</th>
              <th className="text-right px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-secondary/30">
                <td className="px-4 py-2">
                  {t.name}
                  {t.isBuiltIn && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      built-in
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-2">{categoryLabel(t.category)}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs ${t.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {t.isActive ? '有効' : '無効'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => startEdit(t)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(t.id)}
                    className="text-muted-foreground hover:text-destructive p-1 ml-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="text-center py-8 text-sm text-muted-foreground">
            テンプレートがありません。「デフォルト再生成」でビルトインテンプレートを生成してください。
          </p>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => { if (!v) setConfirmDeleteId(null); }}
        title="テンプレートを削除"
        message="このテンプレートを削除しますか？"
        confirmLabel="削除する"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmSeed}
        onOpenChange={setConfirmSeed}
        title="テンプレート再生成"
        message="ビルトインテンプレートを再生成しますか？既存のビルトインテンプレートは上書きされます。"
        confirmLabel="再生成する"
        onConfirm={handleSeed}
      />
    </div>
  );
}
