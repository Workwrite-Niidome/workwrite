'use client';

import { useState } from 'react';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

export function StepCharacterDesigner({ data, onChange }: Props) {
  const [vision, setVision] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState('');

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

  async function handleAiSuggest() {
    if (!vision.trim()) return;
    setAiLoading(true);
    setAiSuggestions('');
    try {
      const prompt = [
        data.genre && `ジャンル: ${data.genre}`,
        data.coreMessage && `テーマ: ${data.coreMessage}`,
        `著者のビジョン: ${vision}`,
      ].filter(Boolean).join('\n');

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/works/none/creation/characters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({ vision: prompt, genre: data.genre, themes: data.coreMessage }),
        }
      );

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
          if (d === '[DONE]') break;
          try {
            const parsed = JSON.parse(d);
            if (parsed.text) setAiSuggestions((prev) => prev + parsed.text);
          } catch { /* skip */ }
        }
      }
    } catch {
      setAiSuggestions('AIの提案を取得できませんでした。');
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
              rows={2}
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
        {aiSuggestions && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">AIの提案（参考にして自分のキャラクターを作りましょう）:</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiSuggestions}</div>
          </div>
        )}
      </div>
    </div>
  );
}
