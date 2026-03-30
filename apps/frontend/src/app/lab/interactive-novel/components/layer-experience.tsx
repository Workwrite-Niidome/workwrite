'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import type { Episode } from '@/lib/api';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, NovelQuote, NovelDialogue, NovelContext, FullTextLink, Hint } from './shared';

type SubMode = 'characters' | 'emotion' | 'novel-mode';

const subModes: { id: SubMode; title: string; desc: string }[] = [
  { id: 'characters', title: 'キャラクターに出会う', desc: '登場人物と会話する' },
  { id: 'emotion', title: '感情から入る', desc: '気分でシーンを体験' },
  { id: 'novel-mode', title: 'ノベルモード', desc: 'シーンごとに進める' },
];

export function LayerExperience({ data, onBack }: { data: WorkData; onBack: () => void }) {
  const [sub, setSub] = useState<SubMode>('characters');

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <BackButton onClick={onBack} />
      <SectionHeader title="読まずに体験する" subtitle="小説を読む前に、この世界に触れる" />

      <div className="grid grid-cols-3 gap-2 max-w-md mx-auto mb-8">
        {subModes.map(m => (
          <Card
            key={m.id}
            className={`px-3 py-3 text-center cursor-pointer transition-all ${sub === m.id ? 'border-primary/30 shadow-sm' : 'hover:border-primary/20'}`}
            onClick={() => setSub(m.id)}
          >
            <p className="text-sm font-medium mb-0.5">{m.title}</p>
            <p className="text-[10px] text-muted-foreground">{m.desc}</p>
          </Card>
        ))}
      </div>

      {sub === 'characters' && <CharacterEncounter data={data} />}
      {sub === 'emotion' && <EmotionDive data={data} />}
      {sub === 'novel-mode' && <NovelMode data={data} />}
    </div>
  );
}

// ===== Character Encounter (Real API) =====

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function CharacterEncounter({ data }: { data: WorkData }) {
  const [selectedChar, setSelectedChar] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const publicChars = data.characters.filter(c => c.isPublic);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (msg: string) => {
    if (!selectedChar || !msg.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: msg.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await api.fetchSSE(
        `/ai/character-talk/${data.work.id}/chat`,
        {
          message: msg.trim(),
          mode: 'character',
          characterId: selectedChar.id,
          useSonnet: false, // Haiku for cost efficiency
        },
        controller.signal,
      );

      await consumeSSEStream(response, (parsed) => {
        if (parsed.error) {
          setError(parsed.error);
          return;
        }
        if (parsed.text) {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + parsed.text };
            }
            return updated;
          });
        }
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'エラーが発生しました');
    } finally {
      setIsStreaming(false);
    }
  }, [selectedChar, data.work.id, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div>
      <p className="text-center text-sm text-muted-foreground mb-5">
        キャラクターを選んで会話してみてください。実際のキャラクタートークAPIに接続しています。
      </p>

      {/* Character selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {publicChars.map(char => (
          <Card
            key={char.id}
            className={`px-3 py-4 text-center cursor-pointer transition-all hover:shadow-md ${selectedChar?.id === char.id ? 'border-primary/30' : 'hover:border-primary/20'}`}
            onClick={() => {
              setSelectedChar(char);
              setMessages([]);
              setError(null);
            }}
          >
            <p className="text-sm font-medium mb-0.5">{char.name?.split('（')[0]}</p>
            <p className="text-[10px] text-muted-foreground mb-1">{char.role?.split('/')[0]?.trim()}</p>
            {char.speechStyle && (
              <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed font-serif">
                {extractFirstQuote(char.speechStyle)}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Chat interface */}
      {selectedChar && (
        <Card className="p-4">
          <div className="text-center text-sm font-medium mb-3">
            {selectedChar.name?.split('（')[0]}との会話
          </div>

          {/* Messages */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4 px-1">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground/50 py-8">
                メッセージを送って会話を始めてください
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-7 ${
                  msg.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground rounded-br-sm'
                    : 'mr-auto bg-secondary border border-border rounded-bl-sm'
                }`}
              >
                {msg.role === 'assistant' && (
                  <p className="text-[10px] font-sans font-medium tracking-wide mb-1 opacity-70">
                    {selectedChar.name?.split('（')[0]}
                  </p>
                )}
                {msg.content || (isStreaming && i === messages.length - 1 ? (
                  <span className="text-muted-foreground/50">...</span>
                ) : null)}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {error && <p className="text-xs text-destructive mb-2 text-center">{error}</p>}

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${selectedChar.name?.split('（')[0]}に話しかける...`}
              disabled={isStreaming}
              className="flex-1 px-4 py-2.5 bg-transparent border border-border rounded-lg text-sm focus:outline-none focus:border-primary/40 transition-colors disabled:opacity-50"
            />
            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
            >
              送信
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
            1メッセージ = 1cr (Haiku)
          </p>
        </Card>
      )}
    </div>
  );
}

// ===== Emotion Dive (Real Episode Data) =====

function EmotionDive({ data }: { data: WorkData }) {
  const [emotion, setEmotion] = useState<string | null>(null);
  const [sceneContent, setSceneContent] = useState<string | null>(null);
  const [loadingScene, setLoadingScene] = useState(false);

  const emotions = [
    { id: 'warmth', label: '温かさがほしい', epIndex: 1, keyword: '嬉しいのは久しぶり' },
    { id: 'courage', label: '勇気がほしい', epIndex: data.episodes.length > 1 ? data.episodes[data.episodes.length - 2].orderIndex : 1, keyword: '綾瀬詩。小説家' },
    { id: 'tears', label: '泣きたい', epIndex: data.episodes.length > 1 ? data.episodes[data.episodes.length - 2].orderIndex : 1, keyword: '書いてくれて、ありがとう' },
    { id: 'awe', label: '震えたい', epIndex: data.episodes.length > 1 ? data.episodes[data.episodes.length - 2].orderIndex : 1, keyword: '朝、目を覚ますと' },
    { id: 'hope', label: '希望がほしい', epIndex: data.episodes.length > 1 ? data.episodes[data.episodes.length - 2].orderIndex : 1, keyword: 'あなたが読んでくれたから' },
  ];

  const selectEmotion = async (emo: typeof emotions[0]) => {
    setEmotion(emo.id);
    setLoadingScene(true);

    const ep = data.episodes.find(e => e.orderIndex === emo.epIndex);
    if (!ep) { setLoadingScene(false); return; }

    try {
      let content = ep.content;
      if (!content || content.length < 100) {
        const res: any = await api.getEpisode(ep.id);
        content = res?.data?.content ?? res?.content ?? '';
      }

      // Find the passage around the keyword
      const idx = content.indexOf(emo.keyword);
      if (idx >= 0) {
        const start = Math.max(0, content.lastIndexOf('\n\n', idx - 200));
        const end = Math.min(content.length, content.indexOf('\n\n', idx + 200));
        setSceneContent(content.slice(start, end > start ? end : idx + 300).trim());
      } else {
        // Fallback: show last 500 chars of episode
        setSceneContent(content.slice(-500).trim());
      }
    } catch {
      setSceneContent(null);
    } finally {
      setLoadingScene(false);
    }
  };

  return (
    <div>
      <p className="text-center text-sm text-muted-foreground mb-4">今のあなたの気分を選んでください。</p>
      <div className="flex gap-2 justify-center flex-wrap mb-6">
        {emotions.map(e => (
          <Button
            key={e.id}
            variant={emotion === e.id ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => selectEmotion(e)}
          >
            {e.label}
          </Button>
        ))}
      </div>

      {loadingScene && <p className="text-center text-sm text-muted-foreground py-8">シーンを探しています...</p>}

      {!loadingScene && sceneContent && (
        <div className="animate-fade-in">
          <Card className="p-6">
            <div className="font-serif text-[15px] leading-8 space-y-4">
              {sceneContent.split('\n\n').map((para, i) => (
                <p key={i} style={{ textIndent: '1em' }}>{para.replace(/^　+/, '')}</p>
              ))}
            </div>
          </Card>
          <FullTextLink label="この場面の前後を読む" />
        </div>
      )}
    </div>
  );
}

// ===== Novel Mode (Real Episode Data) =====

function NovelMode({ data }: { data: WorkData }) {
  const [epIdx, setEpIdx] = useState(0);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [scenes, setScenes] = useState<VNScene[]>([]);
  const [loading, setLoading] = useState(false);

  const episode = data.episodes[epIdx];

  useEffect(() => {
    if (!episode) return;
    setLoading(true);
    setSceneIdx(0);

    const loadEp = async () => {
      let content = episode.content;
      if (!content || content.length < 100) {
        try {
          const res: any = await api.getEpisode(episode.id);
          content = res?.data?.content ?? res?.content ?? '';
        } catch {
          content = '';
        }
      }
      setScenes(buildVNScenes(content, episode.title));
      setLoading(false);
    };
    loadEp();
  }, [episode]);

  const scene = scenes[sceneIdx];

  return (
    <div>
      <p className="text-center text-sm text-muted-foreground mb-4">エピソードを選んでシーンを進めてください。</p>

      {/* Episode selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 -mx-2 px-2">
        {data.episodes.map((ep, i) => (
          <Button
            key={ep.id}
            variant={i === epIdx ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => setEpIdx(i)}
          >
            {ep.orderIndex}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">読み込み中...</p>
      ) : scene ? (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 bg-secondary/50 border-b border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground">第{episode.orderIndex}話 {episode.title}</span>
            <span className="text-[10px] text-muted-foreground/60">{sceneIdx + 1} / {scenes.length}</span>
          </div>

          <div className="px-5 py-8 min-h-[180px] flex flex-col justify-center">
            {scene.type === 'dialogue' && scene.speaker ? (
              <Card className="px-5 py-4 mx-auto max-w-md">
                <p className="text-xs font-sans font-medium tracking-wide mb-1.5" style={{ color: getCharacterColor(scene.speaker) }}>
                  {scene.speaker}
                </p>
                <p className="text-base leading-8 font-serif">{scene.text}</p>
              </Card>
            ) : (
              <p className="text-center text-[15px] text-foreground/80 leading-8 font-light font-serif max-w-md mx-auto">
                {scene.text}
              </p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => setSceneIdx(Math.max(0, sceneIdx - 1))} disabled={sceneIdx === 0}>
              &#8592; 前へ
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSceneIdx(Math.min(scenes.length - 1, sceneIdx + 1))} disabled={sceneIdx === scenes.length - 1}>
              次へ &#8594;
            </Button>
          </div>
        </Card>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">シーンデータがありません</p>
      )}
    </div>
  );
}

// ===== Helpers =====

interface VNScene {
  type: 'narration' | 'dialogue';
  speaker?: string;
  text: string;
}

function buildVNScenes(content: string, title: string): VNScene[] {
  const scenes: VNScene[] = [];
  const blocks = content.split(/\n{2,}/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed === '***' || trimmed === '＊＊＊') continue;

    // Character label followed by speech (蒼。\n\n　　text)
    const charMatch = trimmed.match(/^(?:　*)(蒼|先生|ミナ|凛|梗介|榊)。\s*$/);
    if (charMatch) {
      // Next block will be their speech; add placeholder
      scenes.push({ type: 'dialogue', speaker: charMatch[1], text: '' });
      continue;
    }

    // Indented text (AI character speech continuation)
    if (trimmed.startsWith('　　') && scenes.length > 0) {
      const last = scenes[scenes.length - 1];
      if (last.type === 'dialogue' && last.speaker && !last.text) {
        last.text = trimmed.replace(/^　+/gm, '').trim();
        continue;
      }
    }

    // Dialogue line
    const dialogueMatch = trimmed.match(/^(?:　*)「([^」]+)」/);
    if (dialogueMatch && trimmed.length < 200) {
      scenes.push({ type: 'dialogue', text: trimmed.replace(/^　+/, '') });
      continue;
    }

    // Narration (keep short for VN mode)
    if (trimmed.length > 10) {
      const text = trimmed.replace(/^　+/, '').slice(0, 200);
      scenes.push({ type: 'narration', text });
    }
  }

  // Remove empty dialogue scenes
  return scenes.filter(s => s.text.length > 0).slice(0, 40);
}

function extractFirstQuote(s: string): string {
  const m = s.match(/「([^」]+)」/);
  return m ? `「${m[1]}」` : s.slice(0, 40);
}

function getCharacterColor(name?: string): string {
  if (!name) return 'var(--color-accent)';
  const colors: Record<string, string> = {
    '蒼': '#5a7aa0', '先生': '#9a8a50', 'ミナ': '#b06080',
    '凛': '#b08060', '梗介': '#7a8a7a', '榊': '#8a7a6a', '詩': '#a07080',
  };
  return colors[name] || 'var(--color-accent)';
}
