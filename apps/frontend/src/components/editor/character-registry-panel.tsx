'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api, type StoryCharacter } from '@/lib/api';
import { Plus, Trash2, ChevronDown, ChevronRight, Upload, Eye, EyeOff, X, Sparkles, UserPlus, ScanSearch } from 'lucide-react';

interface Props {
  workId: string;
  onClose: () => void;
}

const ROLE_OPTIONS = ['主人公', 'ヒロイン', 'ライバル', '敵役', 'メンター', '脇役', 'その他'];
const GENDER_OPTIONS = ['男性', '女性', 'その他', '不明'];

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
      // Parse remaining
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
      // Parse JSON
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
      // Get episodes for this work
      const work = await api.getWork(workId);
      const episodes = (work as any).data?.episodes || (work as any).episodes || [];
      // Concatenate episode content (limit to prevent token overflow)
      let text = '';
      for (const ep of episodes) {
        if (ep.content) {
          text += ep.content.slice(0, 2000) + '\n\n';
          if (text.length > 8000) break;
        }
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

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-medium">キャラクター設定</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium">キャラクター設定</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        {characters.length === 0 && !showAiPanel && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">キャラクターが未登録です</p>
            <Button size="sm" variant="outline" onClick={handleMigrate} disabled={migrating} className="gap-1 text-xs">
              <Upload className="h-3 w-3" />
              {migrating ? '移行中...' : '作品設定から移行'}
            </Button>
          </div>
        )}

        {characters.map((char) => {
          const isExpanded = expandedId === char.id;
          return (
            <div key={char.id} className="border border-border rounded-lg">
              <button
                onClick={() => setExpandedId(isExpanded ? null : char.id)}
                className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/30 transition-colors"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{char.name}</span>
                  <span className="text-[10px] text-muted-foreground">{char.role}{char.gender ? ` · ${char.gender}` : ''}{char.firstPerson ? ` · 「${char.firstPerson}」` : ''}</span>
                </div>
                {char.isPublic && <Eye className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">名前</label>
                      <Input
                        value={char.name}
                        onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, name: e.target.value } : c))}
                        onBlur={() => handleUpdate(char.id, { name: char.name })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">役割</label>
                      <select
                        value={char.role}
                        onChange={(e) => { setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, role: e.target.value } : c)); handleUpdate(char.id, { role: e.target.value }); }}
                        className="w-full h-7 text-xs rounded-md border border-border bg-background px-2"
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">性別</label>
                      <select
                        value={char.gender || ''}
                        onChange={(e) => { setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, gender: e.target.value } : c)); handleUpdate(char.id, { gender: e.target.value }); }}
                        className="w-full h-7 text-xs rounded-md border border-border bg-background px-2"
                      >
                        <option value="">未設定</option>
                        {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">一人称</label>
                      <Input
                        value={char.firstPerson || ''}
                        onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, firstPerson: e.target.value } : c))}
                        onBlur={() => handleUpdate(char.id, { firstPerson: char.firstPerson })}
                        placeholder="僕/私/俺"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">年齢</label>
                      <Input
                        value={char.age || ''}
                        onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, age: e.target.value } : c))}
                        onBlur={() => handleUpdate(char.id, { age: char.age })}
                        placeholder="17歳"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">性格</label>
                    <Input
                      value={char.personality || ''}
                      onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, personality: e.target.value } : c))}
                      onBlur={() => handleUpdate(char.id, { personality: char.personality })}
                      placeholder="内向的だが正義感が強い"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">口調</label>
                    <Input
                      value={char.speechStyle || ''}
                      onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, speechStyle: e.target.value } : c))}
                      onBlur={() => handleUpdate(char.id, { speechStyle: char.speechStyle })}
                      placeholder="丁寧語、「〜だと思います」が口癖"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">外見</label>
                    <Textarea
                      value={char.appearance || ''}
                      onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, appearance: e.target.value } : c))}
                      onBlur={() => handleUpdate(char.id, { appearance: char.appearance })}
                      placeholder="黒髪のショートカット、常にメガネ"
                      rows={2} className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">背景・過去</label>
                    <Textarea
                      value={char.background || ''}
                      onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, background: e.target.value } : c))}
                      onBlur={() => handleUpdate(char.id, { background: char.background })}
                      rows={2} className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">動機・目標</label>
                    <Input
                      value={char.motivation || ''}
                      onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, motivation: e.target.value } : c))}
                      onBlur={() => handleUpdate(char.id, { motivation: char.motivation })}
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">キャラクターアーク（成長の方向）</label>
                    <Input
                      value={char.arc || ''}
                      onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, arc: e.target.value } : c))}
                      onBlur={() => handleUpdate(char.id, { arc: char.arc })}
                      placeholder="臆病→勇気を持つ"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">著者メモ</label>
                    <Textarea
                      value={char.notes || ''}
                      onChange={(e) => setCharacters((prev) => prev.map((c) => c.id === char.id ? { ...c, notes: e.target.value } : c))}
                      onBlur={() => handleUpdate(char.id, { notes: char.notes })}
                      rows={2} className="text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleUpdate(char.id, { isPublic: !char.isPublic })}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {char.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {char.isPublic ? '読者に公開中' : '非公開'}
                    </button>
                    <div className="flex gap-1">
                      {saving === char.id && <span className="text-[10px] text-muted-foreground">保存中...</span>}
                      <button onClick={() => handleDelete(char.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ─── AI Suggestion Panel ───────────────────────────── */}
        {showAiPanel && (
          <div className="border border-primary/20 rounded-lg p-3 space-y-2 bg-primary/[0.02]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                AIにキャラクターを提案してもらう
              </h4>
              <button onClick={() => { setShowAiPanel(false); setAiSuggestions([]); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Textarea
              value={aiVision}
              onChange={(e) => setAiVision(e.target.value)}
              rows={2}
              placeholder="どんなキャラクターが必要ですか？（例: 主人公の相棒になる陽気な盗賊）"
              className="text-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAiSuggest}
              disabled={aiLoading || !aiVision.trim()}
              className="w-full gap-1 text-xs"
            >
              <Sparkles className="h-3 w-3" />
              {aiLoading ? '考え中...' : 'AIに提案してもらう'}
            </Button>

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] text-muted-foreground">提案されたキャラクター（採用すると自動保存されます）</p>
                {aiSuggestions.map((ai, i) => {
                  const alreadyExists = characters.some((c) => c.name === ai.name);
                  return (
                    <div key={i} className="p-2.5 bg-muted/30 rounded-md border border-border/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium">{ai.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">({ai.role})</span>
                        </div>
                        <Button
                          size="sm"
                          variant={alreadyExists ? 'ghost' : 'secondary'}
                          onClick={() => handleAdoptAiChar(ai)}
                          disabled={alreadyExists}
                          className="h-6 gap-1 text-[10px] px-2"
                        >
                          <UserPlus className="h-3 w-3" />
                          {alreadyExists ? '登録済み' : '採用'}
                        </Button>
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        {(ai.gender || ai.age || ai.firstPerson) && (
                          <p>{[ai.gender, ai.age, ai.firstPerson && `一人称「${ai.firstPerson}」`].filter(Boolean).join(' / ')}</p>
                        )}
                        {ai.personality && <p>性格: {ai.personality}</p>}
                        {ai.speechStyle && <p>口調: {ai.speechStyle}</p>}
                        {ai.appearance && <p>外見: {ai.appearance}</p>}
                        {ai.background && <p>背景: {ai.background}</p>}
                        {ai.motivation && <p>動機: {ai.motivation}</p>}
                      </div>
                    </div>
                  );
                })}
                {aiAdvice && (
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800/50">
                    <p className="text-[10px] text-blue-700 dark:text-blue-400">{aiAdvice}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Extracted characters ──────────────────────────── */}
        {extractedChars.length > 0 && (
          <div className="border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 space-y-2 bg-amber-50/50 dark:bg-amber-950/20">
            <h4 className="text-xs font-medium flex items-center gap-1">
              <ScanSearch className="h-3 w-3 text-amber-600" />
              本文から検出されたキャラクター
            </h4>
            {extractedChars.map((ex, i) => {
              const alreadyExists = characters.some((c) => c.name === ex.name);
              return (
                <div key={i} className="flex items-center justify-between p-2 bg-background/80 rounded-md border border-border/50">
                  <div className="min-w-0">
                    <span className="text-xs font-medium">{ex.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">({ex.role})</span>
                    {ex.personality && <p className="text-[10px] text-muted-foreground truncate">{ex.personality}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyExists ? 'ghost' : 'secondary'}
                    onClick={() => handleAdoptExtracted(ex)}
                    disabled={alreadyExists}
                    className="h-6 gap-1 text-[10px] px-2 flex-shrink-0"
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

      <div className="flex-shrink-0 p-3 border-t space-y-1.5">
        <Button size="sm" variant="outline" onClick={handleAdd} className="w-full gap-1 text-xs">
          <Plus className="h-3 w-3" /> 手動で追加
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAiPanel(!showAiPanel)}
          className="w-full gap-1 text-xs"
        >
          <Sparkles className="h-3 w-3" />
          AIに提案してもらう
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExtractFromText}
          disabled={extracting}
          className="w-full gap-1 text-xs text-muted-foreground"
        >
          <ScanSearch className="h-3 w-3" />
          {extracting ? '検出中...' : '本文からキャラクターを検出'}
        </Button>
        {characters.length === 0 && (
          <Button size="sm" variant="ghost" onClick={handleMigrate} disabled={migrating} className="w-full gap-1 text-xs text-muted-foreground">
            <Upload className="h-3 w-3" /> {migrating ? '移行中...' : '作品設定から移行'}
          </Button>
        )}
      </div>
    </div>
  );
}
