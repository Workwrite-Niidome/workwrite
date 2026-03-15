'use client';

import { useState } from 'react';
import { Sparkles, Plus, Trash2, UserPlus, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { WizardData, CustomFieldDef } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

/** Structured character — all fields stored individually for downstream AI use */
export interface WizardCharacter {
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
  /** Legacy flat description (manual input or fallback) */
  description?: string;
  aiSuggested: boolean;
  customFieldValues?: Record<string, string>;
}

interface AiCharacter {
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

const ROLE_OPTIONS = ['主人公', 'ヒロイン', 'ライバル', '敵役', 'メンター', '脇役', 'その他'];

// ─── Genre-based default custom fields ──────────────────────

const GENRE_FIELD_TEMPLATES: Record<string, { name: string; inputType: 'text' | 'textarea' | 'select'; options?: string[] }[]> = {
  fantasy: [
    { name: '種族', inputType: 'text' },
    { name: '職業', inputType: 'text' },
    { name: '武器', inputType: 'text' },
    { name: '魔力・スキル', inputType: 'textarea' },
  ],
  sf: [
    { name: '所属組織', inputType: 'text' },
    { name: '搭乗機体/装備', inputType: 'text' },
    { name: '出身惑星・地域', inputType: 'text' },
  ],
  horror: [
    { name: '異能の名称と詳細', inputType: 'textarea' },
    { name: '人間かどうか', inputType: 'select', options: ['人間', '非人間', '不明'] },
    { name: '秘密', inputType: 'textarea' },
  ],
  romance: [
    { name: '家族構成', inputType: 'text' },
    { name: '職業', inputType: 'text' },
    { name: '趣味', inputType: 'text' },
  ],
  drama: [
    { name: '家族構成', inputType: 'text' },
    { name: '職業', inputType: 'text' },
    { name: '趣味', inputType: 'text' },
  ],
};

function getDefaultFieldsForGenre(genre: string): CustomFieldDef[] {
  const templates = GENRE_FIELD_TEMPLATES[genre];
  if (!templates) return [];
  return templates.map((t, i) => ({
    id: crypto.randomUUID(),
    name: t.name,
    inputType: t.inputType,
    options: t.options,
    order: i,
  }));
}

function parseAiResponse(raw: string): { characters: AiCharacter[]; suggestions: string } | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const json = JSON.parse(cleaned.slice(start, end + 1));
    return {
      characters: json.characters || [],
      suggestions: json.suggestions || '',
    };
  } catch {
    return null;
  }
}

function aiCharToCharacter(ai: AiCharacter): WizardCharacter {
  return {
    name: ai.name,
    role: ai.role || '',
    gender: ai.gender,
    age: ai.age,
    firstPerson: ai.firstPerson,
    personality: ai.personality,
    speechStyle: ai.speechStyle,
    appearance: ai.appearance,
    background: ai.background,
    motivation: ai.motivation,
    relationships: ai.relationships,
    uniqueTrait: ai.uniqueTrait,
    aiSuggested: true,
    customFieldValues: {},
  };
}

export function StepCharacterDesigner({ data, onChange }: Props) {
  const [vision, setVision] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [aiParsed, setAiParsed] = useState<{ characters: AiCharacter[]; suggestions: string } | null>(
    data._aiCharacterSuggestions || null
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showFieldManager, setShowFieldManager] = useState(false);

  const characters = (data.characters || []) as WizardCharacter[];
  const customFields = data.customFieldDefinitions || [];

  // Auto-apply genre template if no custom fields exist yet
  const [genreApplied, setGenreApplied] = useState<string | null>(null);
  if (data.genre && data.genre !== genreApplied && customFields.length === 0) {
    const defaults = getDefaultFieldsForGenre(data.genre);
    if (defaults.length > 0) {
      setTimeout(() => {
        onChange({ customFieldDefinitions: defaults });
        setGenreApplied(data.genre);
      }, 0);
    } else {
      setGenreApplied(data.genre);
    }
  }

  function addCharacter() {
    const newChars = [...characters, { name: '', role: '', aiSuggested: false, customFieldValues: {} }];
    onChange({ characters: newChars });
    setExpandedIndex(newChars.length - 1);
  }

  function updateCharacter(index: number, field: string, value: string) {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ characters: updated });
  }

  function updateCustomField(charIndex: number, fieldId: string, value: string) {
    const updated = [...characters];
    const char = updated[charIndex];
    updated[charIndex] = {
      ...char,
      customFieldValues: { ...(char.customFieldValues || {}), [fieldId]: value },
    };
    onChange({ characters: updated });
  }

  function removeCharacter(index: number) {
    onChange({ characters: characters.filter((_, i) => i !== index) });
    if (expandedIndex === index) setExpandedIndex(null);
  }

  function adoptCharacter(ai: AiCharacter) {
    const exists = characters.some((c) => c.name === ai.name);
    if (exists) return;
    const newChars = [...characters, aiCharToCharacter(ai)];
    onChange({ characters: newChars });
    setExpandedIndex(newChars.length - 1);
  }

  function adoptAllCharacters() {
    if (!aiParsed) return;
    const existingNames = new Set(characters.map((c) => c.name));
    const newChars = aiParsed.characters
      .filter((ai) => !existingNames.has(ai.name))
      .map(aiCharToCharacter);
    onChange({ characters: [...characters, ...newChars] });
  }

  // ─── Custom Field Management ─────────────────────────────

  function addCustomField() {
    const newField: CustomFieldDef = {
      id: crypto.randomUUID(),
      name: '',
      inputType: 'text',
      order: customFields.length,
    };
    onChange({ customFieldDefinitions: [...customFields, newField] });
  }

  function updateCustomFieldDef(index: number, partial: Partial<CustomFieldDef>) {
    const updated = [...customFields];
    updated[index] = { ...updated[index], ...partial };
    onChange({ customFieldDefinitions: updated });
  }

  function removeCustomFieldDef(index: number) {
    onChange({ customFieldDefinitions: customFields.filter((_, i) => i !== index) });
  }

  function applyGenreDefaults() {
    if (!data.genre) return;
    const defaults = getDefaultFieldsForGenre(data.genre);
    if (defaults.length > 0) {
      onChange({ customFieldDefinitions: defaults });
    }
  }

  // ─── AI ───────────────────────────────────────────────────

  async function handleAiSuggest() {
    if (!vision.trim()) return;
    setAiLoading(true);
    setAiRaw('');
    setAiParsed(null);
    let accumulated = '';
    try {
      const prompt = [
        data.genre && `ジャンル: ${data.genre}`,
        data.coreMessage && `テーマ: ${data.coreMessage}`,
        data.inspiration && `インスピレーション: ${data.inspiration}`,
        data.targetEmotions && `読者に感じてほしい感情: ${data.targetEmotions}`,
        data.readerJourney && `読者の旅路: ${data.readerJourney}`,
        `著者のビジョン: ${vision}`,
      ].filter(Boolean).join('\n');

      const res = await api.fetchSSE('/works/none/creation/characters', {
        vision: prompt,
        genre: data.genre || undefined,
        themes: data.coreMessage || undefined,
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
            if (parsed.text) {
              accumulated += parsed.text;
              setAiRaw(accumulated);
            }
          } catch { /* skip */ }
        }
      }
      if (buffer.trim()) {
        const remaining = buffer.trim();
        if (remaining.startsWith('data: ')) {
          const d = remaining.slice(6).trim();
          if (d !== '[DONE]') {
            try {
              const parsed = JSON.parse(d);
              if (parsed.text) {
                accumulated += parsed.text;
                setAiRaw(accumulated);
              }
            } catch { /* skip */ }
          }
        }
      }
      const result = parseAiResponse(accumulated);
      if (result) {
        setAiParsed(result);
        onChange({ _aiCharacterSuggestions: result });
      }
    } catch (err) {
      setAiRaw(`AIの提案を取得できませんでした。${err instanceof Error ? `\n${err.message}` : ''}`);
    } finally {
      setAiLoading(false);
    }
  }

  function charSummary(c: WizardCharacter): string {
    const parts = [
      c.gender,
      c.age,
      c.firstPerson && `「${c.firstPerson}」`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : '';
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">キャラクター</h2>
        <p className="text-sm text-muted-foreground">
          物語を動かすキャラクターを設計しましょう。自分で作成するか、AIに相談できます。
        </p>
      </div>

      {/* Custom field manager toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {customFields.length > 0 && `カスタムフィールド: ${customFields.map(f => f.name).filter(Boolean).join(', ')}`}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setShowFieldManager(!showFieldManager)} className="gap-1 text-xs">
          <Settings className="h-3 w-3" />
          カスタムフィールド管理
        </Button>
      </div>

      {/* Custom field manager */}
      {showFieldManager && (
        <div className="p-3 border border-border rounded-lg space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">カスタムフィールド定義</p>
            {data.genre && GENRE_FIELD_TEMPLATES[data.genre] && (
              <Button variant="ghost" size="sm" onClick={applyGenreDefaults} className="text-[10px]">
                ジャンルデフォルトに戻す
              </Button>
            )}
          </div>
          {customFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-center">
              <Input
                value={field.name}
                onChange={(e) => updateCustomFieldDef(i, { name: e.target.value })}
                placeholder="フィールド名"
                className="h-7 text-xs flex-1"
              />
              <select
                value={field.inputType}
                onChange={(e) => updateCustomFieldDef(i, { inputType: e.target.value as any })}
                className="h-7 text-xs rounded-md border border-border bg-background px-2"
              >
                <option value="text">テキスト</option>
                <option value="textarea">テキストエリア</option>
                <option value="select">選択式</option>
              </select>
              {field.inputType === 'select' && (
                <Input
                  value={(field.options || []).join(', ')}
                  onChange={(e) => updateCustomFieldDef(i, { options: e.target.value.split(/[,、]\s*/).filter(Boolean) })}
                  placeholder="選択肢（カンマ区切り）"
                  className="h-7 text-xs flex-1"
                />
              )}
              <button onClick={() => removeCustomFieldDef(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCustomField} className="gap-1 text-xs">
            <Plus className="h-3 w-3" /> フィールド追加
          </Button>
        </div>
      )}

      {/* Character list */}
      <div className="space-y-3">
        {characters.map((char, i) => {
          const isExpanded = expandedIndex === i;
          return (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              {/* Collapsed header */}
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {char.name || '名前未入力'}
                    {char.aiSuggested && <span className="ml-1.5 text-[10px] text-blue-500">(AI提案)</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {char.role || '役割未設定'}
                    {charSummary(char) && ` · ${charSummary(char)}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeCharacter(i); }}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>

              {/* Expanded form */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">名前</label>
                      <Input
                        value={char.name}
                        onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                        placeholder="キャラクター名"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">役割</label>
                      <select
                        value={char.role}
                        onChange={(e) => updateCharacter(i, 'role', e.target.value)}
                        className="w-full h-7 text-xs rounded-md border border-border bg-background px-2"
                      >
                        <option value="">選択してください</option>
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">性別</label>
                      <select
                        value={char.gender || ''}
                        onChange={(e) => updateCharacter(i, 'gender', e.target.value)}
                        className="w-full h-7 text-xs rounded-md border border-border bg-background px-2"
                      >
                        <option value="">未設定</option>
                        <option value="男性">男性</option>
                        <option value="女性">女性</option>
                        <option value="その他">その他</option>
                        <option value="不明">不明</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">一人称</label>
                      <Input
                        value={char.firstPerson || ''}
                        onChange={(e) => updateCharacter(i, 'firstPerson', e.target.value)}
                        placeholder="僕/私/俺"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">年齢</label>
                      <Input
                        value={char.age || ''}
                        onChange={(e) => updateCharacter(i, 'age', e.target.value)}
                        placeholder="17歳"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">性格</label>
                    <Input
                      value={char.personality || ''}
                      onChange={(e) => updateCharacter(i, 'personality', e.target.value)}
                      placeholder="内向的だが正義感が強い"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">口調</label>
                    <Input
                      value={char.speechStyle || ''}
                      onChange={(e) => updateCharacter(i, 'speechStyle', e.target.value)}
                      placeholder="丁寧語。「〜だと思います」が口癖"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">外見</label>
                    <Input
                      value={char.appearance || ''}
                      onChange={(e) => updateCharacter(i, 'appearance', e.target.value)}
                      placeholder="黒髪のショートカット、常にメガネ"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">背景・過去</label>
                    <Textarea
                      value={char.background || ''}
                      onChange={(e) => updateCharacter(i, 'background', e.target.value)}
                      rows={2} className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">動機・目的</label>
                    <Input
                      value={char.motivation || ''}
                      onChange={(e) => updateCharacter(i, 'motivation', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">他キャラとの関係</label>
                    <Input
                      value={char.relationships || ''}
                      onChange={(e) => updateCharacter(i, 'relationships', e.target.value)}
                      placeholder="主人公の幼馴染、ライバルとは元友人"
                      className="h-7 text-xs"
                    />
                  </div>

                  {/* Custom fields */}
                  {customFields.length > 0 && (
                    <div className="border-t border-border/50 pt-2 mt-2 space-y-2">
                      <p className="text-[10px] text-muted-foreground font-medium">カスタムフィールド</p>
                      {customFields.map((field) => (
                        <div key={field.id}>
                          <label className="text-[10px] text-muted-foreground">{field.name || '名前未設定'}</label>
                          {field.inputType === 'select' ? (
                            <select
                              value={char.customFieldValues?.[field.id] || ''}
                              onChange={(e) => updateCustomField(i, field.id, e.target.value)}
                              className="w-full h-7 text-xs rounded-md border border-border bg-background px-2"
                            >
                              <option value="">選択してください</option>
                              {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : field.inputType === 'textarea' ? (
                            <Textarea
                              value={char.customFieldValues?.[field.id] || ''}
                              onChange={(e) => updateCustomField(i, field.id, e.target.value)}
                              rows={2} className="text-xs"
                            />
                          ) : (
                            <Input
                              value={char.customFieldValues?.[field.id] || ''}
                              onChange={(e) => updateCustomField(i, field.id, e.target.value)}
                              className="h-7 text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={addCharacter} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          キャラクターを追加
        </Button>
      </div>

      {/* AI consultation */}
      <div className="border-t border-border pt-6 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          AIに相談する
        </h3>
        <p className="text-xs text-muted-foreground">
          あなたのビジョンを伝えると、AIがキャラクターのアイデアを提案します。採用するかはあなた次第です。
        </p>
        <Textarea
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          rows={3}
          placeholder="例：孤児院で育った少女が魔法学校に入学する話。友情と裏切りがテーマ。"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAiSuggest}
          disabled={aiLoading || !vision.trim()}
          className="gap-1"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {aiLoading ? '考え中...' : 'AIに提案してもらう'}
        </Button>

        {/* Streaming raw text while loading */}
        {aiLoading && aiRaw && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">生成中...</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground max-h-40 overflow-y-auto">{aiRaw.slice(0, 300)}...</div>
          </div>
        )}

        {/* Parsed AI suggestions */}
        {!aiLoading && aiParsed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">AIの提案（気に入ったキャラクターを採用しましょう）</p>
              <Button variant="outline" size="sm" onClick={adoptAllCharacters} className="gap-1 text-xs">
                <UserPlus className="h-3 w-3" />
                すべて採用
              </Button>
            </div>
            {aiParsed.characters.map((ai, i) => {
              const alreadyAdded = characters.some((c) => c.name === ai.name);
              return (
                <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{ai.name}</span>
                      {ai.role && <span className="text-xs text-muted-foreground ml-2">({ai.role})</span>}
                    </div>
                    <Button
                      variant={alreadyAdded ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => adoptCharacter(ai)}
                      disabled={alreadyAdded}
                      className="gap-1 text-xs"
                    >
                      <UserPlus className="h-3 w-3" />
                      {alreadyAdded ? '採用済み' : '採用'}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {(ai.gender || ai.age || ai.firstPerson) && (
                      <p className="text-foreground/60">
                        {[ai.gender, ai.age, ai.firstPerson && `一人称「${ai.firstPerson}」`].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    {ai.personality && <p><strong>性格:</strong> {ai.personality}</p>}
                    {ai.speechStyle && <p><strong>口調:</strong> {ai.speechStyle}</p>}
                    {ai.appearance && <p><strong>外見:</strong> {ai.appearance}</p>}
                    {ai.background && <p><strong>背景:</strong> {ai.background}</p>}
                    {ai.motivation && <p><strong>動機:</strong> {ai.motivation}</p>}
                    {ai.relationships && <p><strong>関係:</strong> {ai.relationships}</p>}
                    {ai.uniqueTrait && <p><strong>特徴:</strong> {ai.uniqueTrait}</p>}
                  </div>
                </div>
              );
            })}
            {aiParsed.suggestions && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">アドバイス</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 whitespace-pre-wrap">{aiParsed.suggestions}</p>
              </div>
            )}
          </div>
        )}

        {/* Fallback: raw text if parsing failed */}
        {!aiLoading && aiRaw && !aiParsed && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">AIの提案:</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiRaw}</div>
          </div>
        )}
      </div>
    </div>
  );
}
