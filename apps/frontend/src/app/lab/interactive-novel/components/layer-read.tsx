'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Episode } from '@/lib/api';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, NovelQuote, NovelDialogue, NovelContext, FullTextLink, EmotionTag, Hint } from './shared';

/**
 * Layer 1: 読む — ハイブリッドモード
 * エピソード本文を実APIから取得し、構造データ+原文引用で表示
 */
export function LayerRead({ data, onBack }: { data: WorkData; onBack: () => void }) {
  const [selectedEpIdx, setSelectedEpIdx] = useState(0);
  const [episodeContent, setEpisodeContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const episode = data.episodes[selectedEpIdx];

  // Load full episode content
  useEffect(() => {
    if (!episode) return;
    // If episodes already have content from the list API, use it
    if (episode.content && episode.content.length > 100) {
      setEpisodeContent(episode.content);
      return;
    }
    // Otherwise fetch individually
    setLoadingContent(true);
    api.getEpisode(episode.id)
      .then((res: any) => {
        const ep = res?.data ?? res;
        setEpisodeContent(ep?.content || '');
      })
      .catch(() => setEpisodeContent(null))
      .finally(() => setLoadingContent(false));
  }, [episode]);

  if (!episode) return <p className="text-center text-muted-foreground p-8">エピソードがありません</p>;

  const scenes = episodeContent ? parseScenes(episodeContent) : [];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <BackButton onClick={onBack} />
      <SectionHeader
        title={`${episode.chapterTitle ? episode.chapterTitle + ' ' : ''}${episode.title}`}
        subtitle={`第${episode.orderIndex}話 / ハイブリッドモード`}
      />

      {/* Episode selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-8 -mx-2 px-2">
        {data.episodes.map((ep, i) => (
          <Button
            key={ep.id}
            variant={i === selectedEpIdx ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => { setSelectedEpIdx(i); setEpisodeContent(null); }}
          >
            {ep.orderIndex}
          </Button>
        ))}
      </div>

      {loadingContent ? (
        <p className="text-center text-sm text-muted-foreground py-12">読み込み中...</p>
      ) : scenes.length > 0 ? (
        <>
          {scenes.map((scene, i) => (
            <div key={i}>
              {i > 0 && <Separator />}
              <HybridScene scene={scene} characters={data.characters} />
            </div>
          ))}

          <FullTextLink label={`第${episode.orderIndex}話 全文を読む（${episode.wordCount ? `約${episode.wordCount.toLocaleString()}字` : ''}）`} />
        </>
      ) : episodeContent ? (
        // Fallback: show raw content with basic formatting
        <div className="font-serif text-[15px] leading-8 space-y-4">
          {episodeContent.split('\n\n').slice(0, 10).map((para, i) => (
            <p key={i} style={{ textIndent: '1em' }}>{para.replace(/^　+/, '')}</p>
          ))}
          <Hint>（冒頭10段落を表示中）</Hint>
        </div>
      ) : null}
    </div>
  );
}

// ===== Scene parser =====

interface ParsedScene {
  type: 'narration' | 'dialogue' | 'break';
  speaker?: string;
  text: string;
  isHighlight?: boolean;
}

function parseScenes(content: string): ParsedScene[] {
  const lines = content.split('\n');
  const scenes: ParsedScene[] = [];
  let currentNarration: string[] = [];

  const flushNarration = () => {
    if (currentNarration.length > 0) {
      const text = currentNarration.join('\n').trim();
      if (text) {
        scenes.push({ type: 'narration', text });
      }
      currentNarration = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Scene break
    if (line === '***' || line === '＊＊＊') {
      flushNarration();
      scenes.push({ type: 'break', text: '' });
      continue;
    }

    // Empty line — flush narration block
    if (!line) {
      flushNarration();
      continue;
    }

    // Dialogue line (starts with 「)
    const dialogueMatch = line.match(/^(?:　*)「([^」]*)」$/);
    if (dialogueMatch) {
      flushNarration();
      scenes.push({ type: 'dialogue', text: dialogueMatch[1] });
      continue;
    }

    // Dialogue with speaker context (e.g. 「xxx」と彼は言った)
    const dialogueInline = line.match(/^(?:　*)「([^」]+)」/);
    if (dialogueInline) {
      flushNarration();
      scenes.push({ type: 'dialogue', text: line.replace(/^　+/, '') });
      continue;
    }

    // AI character response lines (蒼。 先生。 ミナ。 followed by indented text)
    const charLabel = line.match(/^(?:　*)(蒼|先生|ミナ|凛|梗介|榊)。$/);
    if (charLabel) {
      flushNarration();
      // Next lines until empty line are this character's speech
      scenes.push({ type: 'dialogue', speaker: charLabel[1], text: '' });
      continue;
    }

    // Aria system response (indented text starting with 　　)
    if (line.startsWith('　　') && scenes.length > 0) {
      const lastScene = scenes[scenes.length - 1];
      if (lastScene.type === 'dialogue' && lastScene.speaker) {
        lastScene.text += (lastScene.text ? '\n' : '') + line.replace(/^　+/, '');
        continue;
      }
    }

    // Regular narration
    currentNarration.push(line);
  }

  flushNarration();

  // Limit to first ~20 meaningful scenes for the hybrid view
  return scenes.filter(s => s.type === 'break' || s.text.length > 0).slice(0, 25);
}

// ===== Hybrid Scene Renderer =====

function HybridScene({ scene, characters }: { scene: ParsedScene; characters: any[] }) {
  if (scene.type === 'break') {
    return <Separator />;
  }

  if (scene.type === 'dialogue') {
    const color = getCharacterColor(scene.speaker);

    if (scene.speaker) {
      return (
        <NovelDialogue speaker={scene.speaker} color={color}>
          {scene.text.split('\n').map((line, i) => (
            <span key={i}>{line}{i < scene.text.split('\n').length - 1 && <br />}</span>
          ))}
        </NovelDialogue>
      );
    }

    // Dialogue without explicit speaker
    return (
      <div className="font-serif text-[15px] leading-8 py-2" style={{ textIndent: '1em' }}>
        {scene.text}
      </div>
    );
  }

  // Narration
  return (
    <div className="font-serif text-[15px] leading-8 py-2" style={{ textIndent: '1em' }}>
      {scene.text.replace(/^　+/, '')}
    </div>
  );
}

function getCharacterColor(name?: string): string {
  if (!name) return 'var(--color-accent)';
  const colors: Record<string, string> = {
    '蒼': '#5a7aa0',
    '先生': '#9a8a50',
    'ミナ': '#b06080',
    '凛': '#b08060',
    '梗介': '#7a8a7a',
    '榊': '#8a7a6a',
    '詩': '#a07080',
  };
  return colors[name] || 'var(--color-accent)';
}
