'use client';

import { useState } from 'react';
import { Sparkles, Plus, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

interface Character {
  name: string;
  role: string;
  description: string;
  aiSuggested: boolean;
}

interface AiCharacter {
  name: string;
  role: string;
  personality?: string;
  background?: string;
  motivation?: string;
  relationships?: string;
  uniqueTrait?: string;
}

function parseAiResponse(raw: string): { characters: AiCharacter[]; suggestions: string } | null {
  try {
    // Strip markdown code fences
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    // Find the JSON object
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

function aiCharToCharacter(ai: AiCharacter): Character {
  const parts = [
    ai.personality && `性格: ${ai.personality}`,
    ai.background && `背景: ${ai.background}`,
    ai.motivation && `動機: ${ai.motivation}`,
    ai.relationships && `関係: ${ai.relationships}`,
    ai.uniqueTrait && `特徴: ${ai.uniqueTrait}`,
  ].filter(Boolean);
  return {
    name: ai.name,
    role: ai.role || '',
    description: parts.join('\n'),
    aiSuggested: true,
  };
}

export function StepCharacterDesigner({ data, onChange }: Props) {
  const [vision, setVision] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [aiParsed, setAiParsed] = useState<{ characters: AiCharacter[]; suggestions: string } | null>(
    data._aiCharacterSuggestions || null
  );

  const characters = (data.characters || []) as Character[];

  function addCharacter() {
    onChange({
      characters: [...characters, { name: '', role: '', description: '', aiSuggested: false }],
    });
  }

  function updateCharacter(index: number, field: keyof Character, value: string) {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ characters: updated });
  }

  function removeCharacter(index: number) {
    onChange({ characters: characters.filter((_, i) => i !== index) });
  }

  function adoptCharacter(ai: AiCharacter) {
    const exists = characters.some((c) => c.name === ai.name);
    if (exists) return;
    onChange({ characters: [...characters, aiCharToCharacter(ai)] });
  }

  function adoptAllCharacters() {
    if (!aiParsed) return;
    const existingNames = new Set(characters.map((c) => c.name));
    const newChars = aiParsed.characters
      .filter((ai) => !existingNames.has(ai.name))
      .map(aiCharToCharacter);
    onChange({ characters: [...characters, ...newChars] });
  }

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
      // Process remaining buffer
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
      // Parse complete response and persist to wizard data
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">キャラクター</h2>
        <p className="text-sm text-muted-foreground">
          物語を動かすキャラクターを設計しましょう。自分で作成するか、AIに相談できます。
        </p>
      </div>

      {/* Manual character creation */}
      <div className="space-y-4">
        {characters.map((char, i) => (
          <div key={i} className="p-4 border border-border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                キャラクター {i + 1}
                {char.aiSuggested && <span className="ml-1 text-blue-500">(AI提案)</span>}
              </span>
              <button onClick={() => removeCharacter(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              value={char.name}
              onChange={(e) => updateCharacter(i, 'name', e.target.value)}
              placeholder="名前"
              className="text-sm"
            />
            <Input
              value={char.role}
              onChange={(e) => updateCharacter(i, 'role', e.target.value)}
              placeholder="役割（主人公、ヒロイン、敵役など）"
              className="text-sm"
            />
            <Textarea
              value={char.description}
              onChange={(e) => updateCharacter(i, 'description', e.target.value)}
              placeholder="性格、背景、動機など"
              rows={3}
              className="text-sm"
            />
          </div>
        ))}
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
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground max-h-40 overflow-y-auto">{aiRaw.slice(0, 200)}...</div>
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
                    {ai.personality && <p><strong>性格:</strong> {ai.personality}</p>}
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
