'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api, type StoryCharacter } from '@/lib/api';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Upload,
  Eye, EyeOff, X, Sparkles, UserPlus, ScanSearch,
  User, Save, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  workId: string;
  onClose: () => void;
}

const ROLE_OPTIONS = ['主人公', 'ヒロイン', 'ライバル', '敵役', 'メンター', '脇役', 'その他'];
const GENDER_OPTIONS = ['男性', '女性', 'その他', '不明'];

const ROLE_COLORS: Record<string, string> = {
  '主人公': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'ヒロイン': 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  'ライバル': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  '敵役': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'メンター': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  '脇役': 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  'その他': 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
};

interface AiSuggestedChar {
  name: string;
  role: string;
  gender?: string;
  age?: string;
  firstPerson?: string;
  personality?: string;
  speechStyle?: string;
  appearance?: string;
  background?: string;
  motivation?: string;
  relationships?: string;
  uniqueTrait?: string;
}

// ─── Inline field component ─────────────────────────────────────

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">{label}</label>
      {children}
    </div>
  );
}

// ─── Character card (expanded) ──────────────────────────────────

function CharacterForm({
  char,
  onUpdate,
  onDelete,
  saving,
}: {
  char: StoryCharacter;
  onUpdate: (id: string, data: Partial<StoryCharacter>) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState(char);
  const [dirty, setDirty] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Sync from parent when char changes externally
  useEffect(() => {
    setLocal(char);
    setDirty(false);
  }, [char.id]);

  function set(partial: Partial<StoryCharacter>) {
    setLocal((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  }

  function save() {
    if (!dirty) return;
    onUpdate(local.id, {
      name: local.name,
      role: local.role,
      gender: local.gender,
      age: local.age,
      firstPerson: local.firstPerson,
      personality: local.personality,
      speechStyle: local.speechStyle,
      appearance: local.appearance,
      background: local.background,
      motivation: local.motivation,
      arc: local.arc,
      notes: local.notes,
      isPublic: local.isPublic,
    });
    setDirty(false);
  }

  const hasOptionalContent = local.appearance || local.background || local.motivation || local.arc || local.notes;

  return (
    <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
      {/* Row 1: Name + Role */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="名前">
          <Input
            value={local.name}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={save}
            className="h-8 text-sm font-medium"
          />
        </Field>
        <Field label="役割">
          <select
            value={local.role}
            onChange={(e) => { set({ role: e.target.value }); setTimeout(save, 0); }}
            className="h-8 text-sm rounded-md border border-border bg-background px-2 min-w-[90px]"
          >
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>

      {/* Row 2: Gender, Age, FirstPerson */}
      <div className="grid grid-cols-3 gap-2">
        <Field label="性別">
          <select
            value={local.gender || ''}
            onChange={(e) => { set({ gender: e.target.value }); setTimeout(save, 0); }}
            className="w-full h-8 text-sm rounded-md border border-border bg-background px-2"
          >
            <option value="">—</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="年齢">
          <Input
            value={local.age || ''}
            onChange={(e) => set({ age: e.target.value })}
            onBlur={save}
            placeholder="17歳"
            className="h-8 text-sm"
          />
        </Field>
        <Field label="一人称">
          <Input
            value={local.firstPerson || ''}
            onChange={(e) => set({ firstPerson: e.target.value })}
            onBlur={save}
            placeholder="僕/私/俺"
            className="h-8 text-sm"
          />
        </Field>
      </div>

      {/* Row 3: Personality + SpeechStyle (core fields) */}
      <Field label="性格">
        <Input
          value={local.personality || ''}
          onChange={(e) => set({ personality: e.target.value })}
          onBlur={save}
          placeholder="内向的だが正義感が強い"
          className="h-8 text-sm"
        />
      </Field>
      <Field label="口調・話し方">
        <Input
          value={local.speechStyle || ''}
          onChange={(e) => set({ speechStyle: e.target.value })}
          onBlur={save}
          placeholder="丁寧語、「〜だと思います」が口癖"
          className="h-8 text-sm"
        />
      </Field>

      {/* Collapsible optional fields */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <MoreHorizontal className="h-3 w-3" />
        {showMore ? '詳細を閉じる' : `詳細を開く${hasOptionalContent ? '（入力あり）' : ''}`}
      </button>

      {showMore && (
        <div className="space-y-3 pl-2 border-l-2 border-border/50">
          <Field label="外見">
            <Textarea
              value={local.appearance || ''}
              onChange={(e) => set({ appearance: e.target.value })}
              onBlur={save}
              placeholder="黒髪のショートカット、常にメガネ"
              rows={2}
              className="text-sm"
            />
          </Field>
          <Field label="背景・過去">
            <Textarea
              value={local.background || ''}
              onChange={(e) => set({ background: e.target.value })}
              onBlur={save}
              placeholder="幼少期に家族を失い..."
              rows={2}
              className="text-sm"
            />
          </Field>
          <Field label="動機・目標">
            <Input
              value={local.motivation || ''}
              onChange={(e) => set({ motivation: e.target.value })}
              onBlur={save}
              placeholder="仲間を守るために強くなりたい"
              className="h-8 text-sm"
            />
          </Field>
          <Field label="成長アーク">
            <Input
              value={local.arc || ''}
              onChange={(e) => set({ arc: e.target.value })}
              onBlur={save}
              placeholder="臆病 → 勇気を持つ"
              className="h-8 text-sm"
            />
          </Field>
          <Field label="著者メモ">
            <Textarea
              value={local.notes || ''}
              onChange={(e) => set({ notes: e.target.value })}
              onBlur={save}
              placeholder="第3章で退場予定..."
              rows={2}
              className="text-sm"
            />
          </Field>
        </div>
      )}

      {/* Footer: Public toggle + save indicator + delete */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <button
          onClick={() => { set({ isPublic: !local.isPublic }); setTimeout(save, 0); }}
          className={cn(
            'flex items-center gap-1 text-xs transition-colors rounded-full px-2 py-0.5',
            local.isPublic
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {local.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {local.isPublic ? '読者に公開' : '非公開'}
        </button>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-muted-foreground animate-pulse">保存中...</span>}
          {dirty && !saving && (
            <Button size="sm" variant="ghost" onClick={save} className="h-6 gap-1 text-xs text-primary">
              <Save className="h-3 w-3" /> 保存
            </Button>
          )}
          <button onClick={() => onDelete(local.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────

export function CharacterRegistryPanel({ workId, onClose }: Props) {
  const [characters, setCharacters] = useState<StoryCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  // AI suggestion state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiVision, setAiVision] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestedChar[]>([]);
  const [aiAdvice, setAiAdvice] = useState('');

  // Extract from text state
  const [extracting, setExtracting] = useState(false);
  const [extractedChars, setExtractedChars] = useState<AiSuggestedChar[]>([]);

  // Bottom action menu
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, [workId]);

  async function loadCharacters() {
    setLoading(true);
    try {
      const res = await api.getCharacters(workId);
      setCharacters(Array.isArray(res) ? res : (res as any).data || []);
    } catch {
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    try {
      const res = await api.createCharacter(workId, { name: '新しいキャラクター', role: '脇役' });
      const newChar = (res as any).data || res;
      setCharacters((prev) => [...prev, newChar]);
      setExpandedId(newChar.id);
    } catch { /* ignore */ }
  }

  async function handleUpdate(id: string, data: Partial<StoryCharacter>) {
    setSaving(id);
    try {
      await api.updateCharacter(workId, id, data);
      setCharacters((prev) => prev.map((c) => c.id === id ? { ...c, ...data } : c));
    } catch { /* ignore */ }
    finally { setSaving(null); }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCharacter(workId, id);
      setCharacters((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { /* ignore */ }
  }

  async function handleMigrate() {
    setMigrating(true);
    try {
      await api.migrateCharacters(workId);
      await loadCharacters();
    } catch { /* ignore */ }
    finally { setMigrating(false); }
  }

  // ─── AI Suggestion ─────────────────────────────────────────

  async function handleAiSuggest() {
    if (!aiVision.trim()) return;
    setAiLoading(true);
    setAiSuggestions([]);
    setAiAdvice('');
    let accumulated = '';
    try {
      const res = await api.fetchSSE('/works/none/creation/characters', {
        vision: aiVision,
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') continue;
          try {
            const parsed = JSON.parse(d);
            if (parsed.text) accumulated += parsed.text;
          } catch { /* skip */ }
        }
      }
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') continue;
          try {
            const parsed = JSON.parse(d);
            if (parsed.text) accumulated += parsed.text;
          } catch { /* skip */ }
        }
      }
      const cleaned = accumulated.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const json = JSON.parse(cleaned.slice(start, end + 1));
        setAiSuggestions(json.characters || []);
        setAiAdvice(json.suggestions || '');
      }
    } catch {
      // Silently fail
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAdoptAiChar(ai: AiSuggestedChar) {
    try {
      const res = await api.createCharacter(workId, {
        name: ai.name,
        role: ai.role || '脇役',
        gender: ai.gender,
        age: ai.age,
        firstPerson: ai.firstPerson,
        personality: ai.personality,
        speechStyle: ai.speechStyle,
        appearance: ai.appearance,
        background: ai.background,
        motivation: ai.motivation,
      });
      const newChar = (res as any).data || res;
      setCharacters((prev) => [...prev, newChar]);
      setExpandedId(newChar.id);
    } catch { /* ignore */ }
  }

  // ─── Extract from episodes ────────────────────────────────

  async function handleExtractFromText() {
    setExtracting(true);
    setExtractedChars([]);
    try {
      // getWork doesn't return episode content, so fetch episode list then load content
      const epRes = await api.getEpisodes(workId);
      const episodeList = (epRes as any).data || epRes || [];
      let text = '';
      for (const ep of episodeList) {
        try {
          const full = await api.getEpisode(ep.id);
          const content = (full as any).data?.content || (full as any).content || '';
          if (content) {
            text += content.slice(0, 2000) + '\n\n';
            if (text.length > 8000) break;
          }
        } catch { /* skip episode */ }
      }
      if (!text.trim()) {
        setExtracting(false);
        return;
      }
      const existing = characters.map((c) => ({ name: c.name, role: c.role }));
      const res = await api.extractCharacters(text, existing);
      const chars = (res as any).data?.characters || (res as any).characters || [];
      setExtractedChars(chars);
    } catch { /* ignore */ }
    finally { setExtracting(false); }
  }

  async function handleAdoptExtracted(ex: AiSuggestedChar) {
    try {
      const res = await api.createCharacter(workId, {
        name: ex.name,
        role: ex.role || '脇役',
        gender: ex.gender,
        personality: ex.personality,
        speechStyle: ex.speechStyle,
      });
      const newChar = (res as any).data || res;
      setCharacters((prev) => [...prev, newChar]);
      setExtractedChars((prev) => prev.filter((c) => c.name !== ex.name));
      setExpandedId(newChar.id);
    } catch { /* ignore */ }
  }

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <User className="h-4 w-4" /> キャラクター設定
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden min-w-0 max-w-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b bg-muted/20 min-w-0">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <User className="h-4 w-4" /> キャラクター設定
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {characters.length}人
          </span>
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Character list */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        {characters.length === 0 && !showAiPanel && (
          <div className="text-center py-10 px-4 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">キャラクターが未登録です</p>
              <p className="text-xs text-muted-foreground mt-1">手動で追加するか、AIに提案してもらいましょう</p>
            </div>
            <div className="flex flex-col gap-2 max-w-[200px] mx-auto">
              <Button size="sm" onClick={handleAdd} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> 追加する
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAiPanel(true)} className="gap-1">
                <Sparkles className="h-3.5 w-3.5" /> AIに提案してもらう
              </Button>
              <Button size="sm" variant="ghost" onClick={handleExtractFromText} disabled={extracting} className="gap-1 text-xs text-muted-foreground">
                <ScanSearch className="h-3 w-3" /> {extracting ? '検出中...' : '本文からキャラクターを検出'}
              </Button>
            </div>
          </div>
        )}

        <div className="p-2 space-y-1">
          {characters.map((char) => {
            const isExpanded = expandedId === char.id;
            const roleColor = ROLE_COLORS[char.role] || ROLE_COLORS['その他'];
            const summary = [char.personality, char.speechStyle && `口調: ${char.speechStyle}`].filter(Boolean).join(' / ');

            return (
              <div
                key={char.id}
                className={cn(
                  'rounded-lg border transition-all',
                  isExpanded
                    ? 'border-primary/30 bg-card shadow-sm'
                    : 'border-border hover:border-border/80 hover:bg-muted/20',
                )}
              >
                {/* Collapsed header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : char.id)}
                  className="w-full flex items-center gap-2.5 p-3 text-left transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{char.name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', roleColor)}>
                        {char.role}
                      </span>
                    </div>
                    {!isExpanded && summary && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{summary}</p>
                    )}
                    {!isExpanded && (char.gender || char.age || char.firstPerson) && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {[char.gender, char.age, char.firstPerson && `「${char.firstPerson}」`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {char.isPublic && !isExpanded && (
                    <Eye className="h-3 w-3 text-green-500 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded form */}
                {isExpanded && (
                  <CharacterForm
                    char={char}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    saving={saving === char.id}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ─── AI Suggestion Panel ───────────────────────────── */}
        {showAiPanel && (
          <div className="mx-2 mb-2 border border-primary/20 rounded-lg p-4 space-y-3 bg-primary/[0.02]">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                AIにキャラクターを提案してもらう
              </h4>
              <button onClick={() => { setShowAiPanel(false); setAiSuggestions([]); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              value={aiVision}
              onChange={(e) => setAiVision(e.target.value)}
              rows={3}
              placeholder="どんなキャラクターが必要ですか？&#10;例: 主人公の相棒になる陽気な盗賊、物語の黒幕になる知的な敵キャラ"
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleAiSuggest}
              disabled={aiLoading || !aiVision.trim()}
              className="w-full gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiLoading ? '考え中...' : 'AIに提案してもらう'}
            </Button>

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">提案されたキャラクター</p>
                {aiSuggestions.map((ai, i) => {
                  const alreadyExists = characters.some((c) => c.name === ai.name);
                  return (
                    <div key={i} className="p-3 bg-background rounded-lg border border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{ai.name}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ROLE_COLORS[ai.role] || ROLE_COLORS['その他'])}>
                            {ai.role}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={alreadyExists ? 'ghost' : 'default'}
                          onClick={() => handleAdoptAiChar(ai)}
                          disabled={alreadyExists}
                          className="h-7 gap-1 text-xs px-3"
                        >
                          <UserPlus className="h-3 w-3" />
                          {alreadyExists ? '登録済み' : '採用'}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {(ai.gender || ai.age || ai.firstPerson) && (
                          <p className="font-medium text-foreground/70">
                            {[ai.gender, ai.age, ai.firstPerson && `一人称「${ai.firstPerson}」`].filter(Boolean).join(' / ')}
                          </p>
                        )}
                        {ai.personality && <p><span className="text-foreground/50">性格:</span> {ai.personality}</p>}
                        {ai.speechStyle && <p><span className="text-foreground/50">口調:</span> {ai.speechStyle}</p>}
                        {ai.appearance && <p><span className="text-foreground/50">外見:</span> {ai.appearance}</p>}
                        {ai.background && <p><span className="text-foreground/50">背景:</span> {ai.background}</p>}
                        {ai.motivation && <p><span className="text-foreground/50">動機:</span> {ai.motivation}</p>}
                      </div>
                    </div>
                  );
                })}
                {aiAdvice && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">アドバイス</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">{aiAdvice}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Extracted characters ──────────────────────────── */}
        {extractedChars.length > 0 && (
          <div className="mx-2 mb-2 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 space-y-2 bg-amber-50/50 dark:bg-amber-950/20">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <ScanSearch className="h-4 w-4 text-amber-600" />
              本文から検出されたキャラクター
            </h4>
            {extractedChars.map((ex, i) => {
              const alreadyExists = characters.some((c) => c.name === ex.name);
              return (
                <div key={i} className="flex items-center justify-between p-2.5 bg-background/80 rounded-lg border border-border/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ex.name}</span>
                      {ex.role && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ROLE_COLORS[ex.role] || ROLE_COLORS['その他'])}>
                          {ex.role}
                        </span>
                      )}
                    </div>
                    {ex.personality && <p className="text-xs text-muted-foreground truncate mt-0.5">{ex.personality}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyExists ? 'ghost' : 'secondary'}
                    onClick={() => handleAdoptExtracted(ex)}
                    disabled={alreadyExists}
                    className="h-7 gap-1 text-xs px-3 flex-shrink-0 ml-2"
                  >
                    <UserPlus className="h-3 w-3" />
                    {alreadyExists ? '登録済み' : '採用'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: Primary action + expandable menu */}
      <div className="flex-shrink-0 border-t bg-muted/10">
        {characters.length > 0 && (
          <>
            <div className="px-3 pt-2 pb-1">
              <Button size="sm" onClick={handleAdd} className="w-full gap-1">
                <Plus className="h-3.5 w-3.5" /> キャラクターを追加
              </Button>
            </div>

            {showActions && (
              <div className="px-3 pb-1 space-y-1 animate-in slide-in-from-bottom-2 duration-200">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowAiPanel(!showAiPanel); setShowActions(false); }}
                  className="w-full gap-1 text-xs"
                >
                  <Sparkles className="h-3 w-3" /> AIに提案してもらう
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { handleExtractFromText(); setShowActions(false); }}
                  disabled={extracting}
                  className="w-full gap-1 text-xs text-muted-foreground"
                >
                  <ScanSearch className="h-3 w-3" /> {extracting ? '検出中...' : '本文からキャラクターを検出'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { handleMigrate(); setShowActions(false); }}
                  disabled={migrating}
                  className="w-full gap-1 text-xs text-muted-foreground"
                >
                  <Upload className="h-3 w-3" /> {migrating ? '移行中...' : '作品設定から移行'}
                </Button>
              </div>
            )}

            <div className="px-3 pb-2">
              <button
                onClick={() => setShowActions(!showActions)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                {showActions ? '閉じる' : 'その他のアクション ▾'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
