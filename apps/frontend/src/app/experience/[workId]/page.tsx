'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { TheaterView } from './components/theater-view';
import { ActionPalette } from './components/action-palette';
import { ExperienceHeader } from './components/experience-header';
import type { SceneBlock, WorldState, ActionSuggestion, PerspectiveMode } from './types';

const CHARACTER_COLORS: Record<string, string> = {
  '蒼': '#5a7aa0',
  '先生': '#9a8a50',
  'ミナ': '#b06080',
  '凛': '#b08060',
  '梗介': '#7a8a7a',
  '榊': '#8a7a6a',
  '詩': '#a07080',
};

function getCharacterColor(name: string): string {
  for (const [key, color] of Object.entries(CHARACTER_COLORS)) {
    if (name.includes(key)) return color;
  }
  return 'var(--color-accent)';
}

let blockIdCounter = 0;
function nextBlockId(): string {
  return `blk-${++blockIdCounter}`;
}

function saveSession(workId: string, blocks: SceneBlock[], state: WorldState) {
  try {
    const data = JSON.stringify({ blocks: blocks.slice(-50), state, savedAt: Date.now() });
    localStorage.setItem(`experience-${workId}`, data);
  } catch { /* ignore */ }
}

function loadSession(workId: string): { blocks: SceneBlock[]; state: WorldState } | null {
  try {
    const raw = localStorage.getItem(`experience-${workId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 24h
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) return null;
    if (!data.blocks?.length || !data.state) return null;
    // Restore blockIdCounter
    blockIdCounter = data.blocks.length + 100;
    return { blocks: data.blocks, state: data.state };
  } catch { return null; }
}

function clearSession(workId: string) {
  try { localStorage.removeItem(`experience-${workId}`); } catch { /* ignore */ }
}

export default function ExperiencePage() {
  const params = useParams();
  const workId = params.workId as string;

  const [blocks, setBlocks] = useState<SceneBlock[]>([]);
  const [worldState, setWorldState] = useState<WorldState>({
    locationId: null,
    locationName: '',
    timeOfDay: 'afternoon',
    timelinePosition: 0,
    perspective: 'character',
    presentCharacters: [],
    actions: [],
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'intro' | 'world'>('loading');
  const [work, setWork] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Load work data
  useEffect(() => {
    async function load() {
      try {
        const [workRes, charsRes, epsRes] = await Promise.all([
          api.getWork(workId).catch(() => null),
          api.getCharacters(workId).catch(() => null),
          api.getEpisodes(workId).catch(() => null),
        ]);
        const w = (workRes as any)?.data ?? workRes;
        const c = (charsRes as any)?.data ?? charsRes ?? [];
        const e = (epsRes as any)?.data ?? epsRes ?? [];

        setWork(w);
        setCharacters(Array.isArray(c) ? c : []);
        setEpisodes(Array.isArray(e) ? e.sort((a: any, b: any) => a.orderIndex - b.orderIndex) : []);

        // Check for saved session
        const saved = loadSession(workId);
        if (saved) {
          setBlocks(saved.blocks);
          setWorldState(saved.state);
          setPhase('world');
        } else {
          setPhase('intro');
        }
      } catch {
        setPhase('intro');
      }
    }
    load();
  }, [workId]);

  // Intro sequence (90-second onboarding, no tutorial)
  useEffect(() => {
    if (phase !== 'intro' || !work) return;

    const introBlocks: SceneBlock[] = [];

    // Cold open — pre-written, not generated
    if (work.title === 'Aria') {
      introBlocks.push(
        { id: nextBlockId(), type: 'environment', source: 'generated', text: '午後の光が、磨りガラスを通って柔らかく広がっている。' },
        { id: nextBlockId(), type: 'environment', source: 'generated', text: '古い紙とインクと、ほんの少しの埃の匂い。' },
        { id: nextBlockId(), type: 'environment', source: 'generated', text: '天井まで届く本棚が、薄暗い奥まで続いている。' },
        { id: nextBlockId(), type: 'environment', source: 'generated', text: '古書店の扉が、開いている。' },
      );
    } else {
      introBlocks.push(
        { id: nextBlockId(), type: 'environment', source: 'generated', text: `${work.title}の世界が広がっている。` },
      );
    }

    // Reveal blocks one by one
    let i = 0;
    const timer = setInterval(() => {
      if (i < introBlocks.length) {
        setBlocks(prev => [...prev, introBlocks[i]]);
        i++;
      } else {
        clearInterval(timer);
        // Set initial world state with first action
        setWorldState(prev => ({
          ...prev,
          locationName: work.title === 'Aria' ? '栞堂の前' : '物語の入口',
          timeOfDay: 'afternoon',
          actions: [
            { type: 'move', label: '中に入る', params: { locationId: 'initial' } },
          ],
        }));
      }
    }, 800);

    return () => clearInterval(timer);
  }, [phase, work]);

  // Add blocks helper
  const addBlocks = useCallback((newBlocks: SceneBlock[]) => {
    setBlocks(prev => [...prev, ...newBlocks.filter(Boolean)]);
  }, []);

  // Auto-save session on state changes
  useEffect(() => {
    if (phase === 'world' && blocks.length > 0) {
      saveSession(workId, blocks, worldState);
    }
  }, [blocks, worldState, phase, workId]);

  // Handle action from palette
  const handleAction = useCallback(async (action: ActionSuggestion) => {
    if (isStreaming) return;

    // Record reader action
    addBlocks([
      { id: nextBlockId(), type: 'action', source: 'reader', text: `（${action.label}）` },
    ]);

    if (action.type === 'move') {
      await handleMove(action);
    } else if (action.type === 'talk') {
      await handleTalk(action);
    } else if (action.type === 'observe') {
      await handleObserve(action);
    } else if (action.type === 'time') {
      await handleTimeAdvance();
    } else if (action.type === 'perspective') {
      handlePerspectiveChange(action.params.mode as PerspectiveMode);
    }
  }, [isStreaming, workId, work, characters, episodes]);

  // Handle free input
  const handleFreeInput = useCallback(async (text: string) => {
    if (isStreaming) return;

    addBlocks([
      { id: nextBlockId(), type: 'action', source: 'reader', text: `（${text}）` },
    ]);

    // Simple intent parsing (Tier 1)
    const normalized = text.toLowerCase();

    // Check character names
    for (const char of worldState.presentCharacters) {
      const shortName = char.name.split('（')[0].split('(')[0];
      if (normalized.includes(shortName.toLowerCase()) || normalized.includes(shortName)) {
        await handleTalk({
          type: 'talk',
          label: `${shortName}と話す`,
          params: { characterId: char.id, message: text },
        });
        return;
      }
    }

    // Check for observation verbs
    if (/見る|眺める|観察|look/.test(normalized)) {
      await handleObserve({ type: 'observe', label: '見る', params: { target: 'environment' } });
      return;
    }

    // Fallback: treat as talk to nearest character or observe
    if (worldState.presentCharacters.length > 0) {
      const char = worldState.presentCharacters[0];
      await handleTalk({
        type: 'talk',
        label: `${char.name.split('（')[0]}と話す`,
        params: { characterId: char.id, message: text },
      });
    } else {
      await handleObserve({ type: 'observe', label: '見る', params: { target: 'environment' } });
    }
  }, [isStreaming, worldState, workId]);

  // === Action Handlers ===

  async function handleMove(action: ActionSuggestion) {
    const locationId = action.params.locationId || 'initial';

    // For now, compose scene based on available data
    const newBlocks: SceneBlock[] = [];
    newBlocks.push({ id: nextBlockId(), type: 'break', source: 'generated', text: '' });

    if (work?.title === 'Aria') {
      const scenes = getAriaScene(locationId, worldState.timelinePosition, characters);
      newBlocks.push(...scenes.blocks);

      setWorldState(prev => ({
        ...prev,
        locationId: locationId as string,
        locationName: scenes.locationName,
        presentCharacters: scenes.characters,
        actions: scenes.actions as ActionSuggestion[],
      }));
    }

    addBlocks(newBlocks);
  }

  async function handleTalk(action: ActionSuggestion) {
    const characterId = action.params.characterId;
    const message = action.params.message || 'こんにちは';
    const char = characters.find((c: any) => c.id === characterId);
    if (!char) return;

    const shortName = char.name?.split('（')[0] || char.name;
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Add empty dialogue block for streaming
    const dialogueBlockId = nextBlockId();
    addBlocks([
      { id: dialogueBlockId, type: 'dialogue', source: 'generated', text: '', speaker: shortName, speakerColor: getCharacterColor(shortName) },
    ]);

    try {
      const response = await api.fetchSSE(
        `/ai/character-talk/${workId}/chat`,
        { message, mode: 'character', characterId, useSonnet: false },
        controller.signal,
      );

      await consumeSSEStream(response, (parsed) => {
        if (parsed.text) {
          setBlocks(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(b => b?.id === dialogueBlockId);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], text: updated[idx].text + parsed.text };
            }
            return updated;
          });
        }
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addBlocks([
        { id: nextBlockId(), type: 'environment', source: 'generated', text: `（${shortName}は静かにこちらを見ている）` },
      ]);
    } finally {
      setIsStreaming(false);
    }

    // Regenerate actions after conversation
    setWorldState(prev => ({
      ...prev,
      actions: generatePostTalkActions(prev, characters),
    }));
  }

  async function handleObserve(action: ActionSuggestion) {
    // Generate observation based on current location and episode data
    const ep = episodes[Math.floor(worldState.timelinePosition * (episodes.length - 1))];
    if (ep) {
      let content = ep.content;
      if (!content || content.length < 100) {
        try {
          const res: any = await api.getEpisode(ep.id);
          content = res?.data?.content ?? res?.content ?? '';
        } catch { content = ''; }
      }

      // Extract a descriptive paragraph
      const paras = content.split(/\n{2,}/).filter((p: string) => {
        const t = p.trim();
        return t.length > 20 && !t.startsWith('「') && !t.startsWith('『');
      });
      if (paras.length > 0) {
        const randomPara = paras[Math.floor(Math.random() * Math.min(3, paras.length))];
        addBlocks([
          { id: nextBlockId(), type: 'environment', source: 'original', text: randomPara.trim().replace(/^　+/, '') },
        ]);
        return;
      }
    }

    addBlocks([
      { id: nextBlockId(), type: 'environment', source: 'generated', text: '静かだ。時間がゆっくりと流れている。' },
    ]);
  }

  async function handleTimeAdvance() {
    const timeOrder: typeof worldState.timeOfDay[] = ['morning', 'afternoon', 'evening', 'night', 'late_night', 'dawn'];
    const currentIdx = timeOrder.indexOf(worldState.timeOfDay);
    const nextTime = timeOrder[(currentIdx + 1) % timeOrder.length];
    const newPosition = Math.min(1, worldState.timelinePosition + 1 / (episodes.length || 21));

    addBlocks([
      { id: nextBlockId(), type: 'break', source: 'generated', text: '' },
      { id: nextBlockId(), type: 'environment', source: 'generated', text: `時間が流れた。` },
    ]);

    setWorldState(prev => ({
      ...prev,
      timeOfDay: nextTime,
      timelinePosition: newPosition,
    }));
  }

  function handlePerspectiveChange(mode: PerspectiveMode) {
    const labels: Record<PerspectiveMode, string> = {
      protagonist: '視点: 主人公',
      character: '視点: あなた',
      omniscient: '視点: 俯瞰',
    };

    addBlocks([
      { id: nextBlockId(), type: 'perspective_label', source: 'generated', text: `───── ${labels[mode]} ─────` },
    ]);

    setWorldState(prev => ({ ...prev, perspective: mode }));

    // If switching to protagonist, show episode text
    if (mode === 'protagonist' && episodes.length > 0) {
      const epIdx = Math.floor(worldState.timelinePosition * (episodes.length - 1));
      const ep = episodes[epIdx];
      if (ep?.content) {
        const firstParagraphs = ep.content.split(/\n{2,}/).slice(0, 3);
        firstParagraphs.forEach((p: string) => {
          const text = p.trim().replace(/^　+/, '');
          if (text.length > 5) {
            addBlocks([
              { id: nextBlockId(), type: 'event', source: 'original', text },
            ]);
          }
        });
      }
    }
  }

  // Loading
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#55555f] text-sm tracking-widest animate-pulse">...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#d8d5d0] flex flex-col" style={{ fontFamily: "'Noto Serif JP', serif" }}>
      <ExperienceHeader
        state={worldState}
        onPerspectiveChange={handlePerspectiveChange}
      />

      <TheaterView blocks={blocks} isStreaming={isStreaming} />

      <ActionPalette
        actions={worldState.actions}
        onAction={handleAction}
        onFreeInput={handleFreeInput}
        disabled={isStreaming}
      />
    </div>
  );
}

// ===== Aria-specific scene data (to be replaced by backend API) =====

function getAriaScene(locationId: string, timelinePosition: number, characters: any[]) {
  const sakaki = characters.find((c: any) => c.name?.includes('榊'));
  const uta = characters.find((c: any) => c.name?.includes('詩'));
  const ao = characters.find((c: any) => c.name?.includes('蒼'));

  if (locationId === 'initial' || locationId === 'shiori-do') {
    const presentChars = [sakaki, uta].filter(Boolean).map((c: any) => ({
      id: c.id,
      name: c.name,
      activity: c.name?.includes('榊') ? '本を読んでいる' : 'バイト中',
    }));

    return {
      locationName: '栞堂',
      blocks: [
        { id: nextBlockId(), type: 'environment' as const, source: 'original' as const, text: '入口は狭い。看板は木彫りで、文字がかすれている。ドアを開けると、古い紙とインクと、ほんの少しの埃の匂いがする。' },
        { id: nextBlockId(), type: 'environment' as const, source: 'original' as const, text: '店内は迷路みたいだ。天井まで届く本棚が所狭しと並んでいて、その間を人がすれ違えるかどうかの通路が曲がりくねっている。' },
        { id: nextBlockId(), type: 'environment' as const, source: 'generated' as const, text: 'カウンターの向こうに、白髪交じりの男性がいる。ベストにスラックス。穏やかな顔。本を読んでいる。' },
        ...(uta ? [{ id: nextBlockId(), type: 'environment' as const, source: 'generated' as const, text: '奥のカウンターで、丸眼鏡の女性がノートに何か書いている。' }] : []),
        { id: nextBlockId(), type: 'dialogue' as const, source: 'original' as const, text: '「いらっしゃい。ゆっくりしていってください」', speaker: '榊', speakerColor: '#8a7a6a' },
      ] satisfies SceneBlock[],
      characters: presentChars,
      actions: [
        ...(sakaki ? [{ type: 'talk' as const, label: '榊と話す', params: { characterId: sakaki.id, message: 'こんにちは' } }] : []),
        ...(uta ? [{ type: 'talk' as const, label: '詩に声をかける', params: { characterId: uta.id, message: 'こんにちは' } }] : []),
        { type: 'observe' as const, label: '本棚を見る', params: { target: 'environment' } },
        { type: 'move' as const, label: '外に出る', params: { locationId: 'shimokitazawa' } },
        { type: 'time' as const, label: '次の日へ', params: {} },
      ],
    };
  }

  if (locationId === 'shimokitazawa') {
    return {
      locationName: '下北沢の路地',
      blocks: [
        { id: nextBlockId(), type: 'environment' as const, source: 'generated' as const, text: '路地裏。古着屋、レコード店、小劇場が並んでいる。' },
        { id: nextBlockId(), type: 'environment' as const, source: 'generated' as const, text: '夕焼けが建物の壁を橙色に染めている。どこかでギターの音がする。' },
      ] satisfies SceneBlock[],
      characters: [],
      actions: [
        { type: 'move' as const, label: '栞堂に入る', params: { locationId: 'shiori-do' } },
        { type: 'observe' as const, label: '路地を歩く', params: { target: 'environment' } },
        { type: 'time' as const, label: '次の日へ', params: {} },
      ],
    };
  }

  // Default
  return {
    locationName: '???',
    blocks: [
      { id: nextBlockId(), type: 'environment' as const, source: 'generated' as const, text: '静かな場所。周囲を見回す。' },
    ] satisfies SceneBlock[],
    characters: [],
    actions: [
      { type: 'move' as const, label: '栞堂へ行く', params: { locationId: 'shiori-do' } },
    ],
  };
}

function generatePostTalkActions(state: WorldState, characters: any[]): ActionSuggestion[] {
  const actions: ActionSuggestion[] = [];

  for (const char of state.presentCharacters) {
    const shortName = char.name.split('（')[0].split('(')[0];
    actions.push({
      type: 'talk',
      label: `${shortName}ともう少し話す`,
      params: { characterId: char.id, message: '' },
    });
  }

  actions.push({ type: 'observe', label: '周りを見る', params: { target: 'environment' } });
  actions.push({ type: 'time', label: '次の日へ', params: {} });

  return actions;
}
