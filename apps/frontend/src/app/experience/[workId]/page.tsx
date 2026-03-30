'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { TheaterView } from './components/theater-view';
import { ActionPalette } from './components/action-palette';
import { ExperienceHeader } from './components/experience-header';
import type { SceneBlock, WorldState, ActionSuggestion, PerspectiveMode } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const CHARACTER_COLORS: Record<string, string> = {
  '蒼': '#5a7aa0', '先生': '#9a8a50', 'ミナ': '#b06080',
  '凛': '#b08060', '梗介': '#7a8a7a', '榊': '#8a7a6a', '詩': '#a07080',
};

function getCharColor(name: string): string {
  for (const [key, color] of Object.entries(CHARACTER_COLORS)) {
    if (name.includes(key)) return color;
  }
  return '#8a8a95';
}

function sn(fullName: string): string {
  let name = fullName.split('（')[0].split('(')[0].trim();
  if (name.includes(' ')) name = name.split(' ')[0];
  if (name.includes('　')) name = name.split('　')[0];
  return name;
}

let blockId = 0;
function bid(): string { return `b-${++blockId}`; }

// Session persistence
function saveSession(workId: string, blocks: SceneBlock[], state: WorldState) {
  try { localStorage.setItem(`exp-${workId}`, JSON.stringify({ blocks: blocks.slice(-50), state, t: Date.now() })); } catch {}
}
function clearSession(workId: string) {
  try { localStorage.removeItem(`exp-${workId}`); } catch {}
}

function loadSession(workId: string): { blocks: SceneBlock[]; state: WorldState } | null {
  try {
    const d = JSON.parse(localStorage.getItem(`exp-${workId}`) || 'null');
    if (!d || Date.now() - d.t > 86400000 || !d.blocks?.length) return null;
    blockId = d.blocks.length + 100;
    return { blocks: d.blocks, state: d.state };
  } catch { return null; }
}

export default function ExperiencePage() {
  const { workId } = useParams() as { workId: string };
  const [blocks, setBlocks] = useState<SceneBlock[]>([]);
  const [worldState, setWorldState] = useState<WorldState>({
    locationId: null, locationName: '', timeOfDay: 'afternoon',
    timelinePosition: 0, perspective: 'character', presentCharacters: [], actions: [],
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'menu' | 'intro' | 'world'>('loading');
  const [work, setWork] = useState<any>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load work data
  useEffect(() => {
    async function load() {
      try {
        const res = await api.getWork(workId).catch(() => null);
        const w = (res as any)?.data ?? res;
        setWork(w);

        // Check saved session
        const saved = loadSession(workId);
        if (saved) {
          setPhase('menu'); // Show menu: resume or restart
        } else {
          setPhase('intro');
        }
      } catch {
        setPhase('intro');
      }
    }
    load();
  }, [workId]);

  // Intro sequence: build world if needed, then atmospheric intro from first episode
  useEffect(() => {
    if (phase !== 'intro') return;
    let cancelled = false;

    async function buildIntro() {
      // Check if world is built, if not trigger build
      try {
        const status = await apiGet('/build-status');
        if (status.data?.locations === 0) {
          // Auto-build the world (may take a few seconds)
          setBlocks([{ id: bid(), type: 'environment', source: 'generated', text: '世界を構築しています...' }]);
          try {
            await apiPost('/build');
          } catch {
            // Build might fail (not completed, etc.) — continue anyway
          }
          if (cancelled) return;
          setBlocks([]);
        }
      } catch {}

      if (cancelled) return;

      // Get intro text from first episode's opening (the ACTUAL story text)
      let introLines: string[] = [];
      try {
        const workRes = await api.getEpisodes(workId);
        const eps = ((workRes as any)?.data ?? workRes ?? []) as any[];
        const sorted = eps.sort((a: any, b: any) => a.orderIndex - b.orderIndex);
        if (sorted.length > 0) {
          const firstEp = sorted[0];
          let content = firstEp.content;
          if (!content || content.length < 50) {
            const epRes = await api.getEpisode(firstEp.id);
            content = (epRes as any)?.data?.content ?? (epRes as any)?.content ?? '';
          }
          if (content) {
            // Take the opening paragraphs (before first dialogue or scene break)
            const paras = content.split(/\n{2,}/);
            for (const para of paras) {
              const t = para.trim().replace(/^　+/, '');
              if (!t) continue;
              if (t.startsWith('「') || t === '***') break; // Stop at first dialogue or break
              const sentences = splitIntoSentences(t);
              introLines.push(...sentences);
              if (introLines.length >= 4) break; // Max 4 intro lines
            }
          }
        }
      } catch {}

      // Fallback
      if (introLines.length === 0) {
        introLines = [`${work?.title || '物語'}の世界が広がっている。`];
      }
      introLines = introLines.slice(0, 5);

      if (cancelled) return;

      // Reveal lines one by one
      let i = 0;
      const timer = setInterval(() => {
        if (cancelled) { clearInterval(timer); return; }
        if (i < introLines.length) {
          setBlocks(prev => [...prev, { id: bid(), type: 'environment', source: 'original', text: introLines[i] }]);
          i++;
        } else {
          clearInterval(timer);
          // Contextual entry action
          setWorldState(prev => ({
            ...prev,
            actions: [{ type: 'move', label: '物語に入る', params: { locationId: 'initial' } }],
          }));
        }
      }, 1200);
    }

    buildIntro();
    return () => { cancelled = true; };
  }, [phase, work]);

  // Auto-save
  useEffect(() => {
    if (phase === 'world' && blocks.length > 0) saveSession(workId, blocks, worldState);
  }, [blocks, worldState, phase, workId]);

  const add = useCallback((b: SceneBlock[]) => { setBlocks(prev => [...prev, ...b.filter(Boolean)]); }, []);

  // ===== API helpers =====
  async function apiPost(path: string, body?: any) {
    const token = api.getToken();
    const res = await fetch(`${API_BASE}/interactive-novel/${workId}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  async function apiGet(path: string) {
    const token = api.getToken();
    const res = await fetch(`${API_BASE}/interactive-novel/${workId}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  function applyScene(scene: any) {
    // Split all text into short sentence-level blocks
    const allBlocks: SceneBlock[] = [];

    // Environment: split into individual sentences
    if (scene.environment?.text) {
      const sentences = splitIntoSentences(scene.environment.text);
      for (const s of sentences) {
        allBlocks.push({ id: bid(), type: 'environment', source: scene.environment.source || 'generated', text: s });
      }
    }

    // Events: split each event's text into sentences
    if (scene.events) {
      for (const ev of scene.events) {
        if (!ev.renderedText?.trim()) continue;
        const sentences = splitIntoSentences(ev.renderedText);
        for (const s of sentences) {
          allBlocks.push({
            id: bid(), type: 'event',
            source: ev.originalPassage ? 'original' : 'generated',
            text: s,
            spoilerProtected: ev.spoilerProtected,
          });
        }
      }
    }

    // Update world state immediately (actions become available)
    setWorldState(prev => ({
      ...prev,
      locationName: scene.meta?.locationName || prev.locationName,
      timeOfDay: scene.meta?.timeOfDay || prev.timeOfDay,
      perspective: scene.meta?.perspective || prev.perspective,
      presentCharacters: (scene.characters || []).map((c: any) => ({
        id: c.characterId, name: c.name, activity: c.activity,
      })),
      actions: (scene.actions || []).map((a: any) => ({
        type: a.type, label: a.label, params: a.params || {},
      })),
    }));

    // Add blocks one by one with delay (typing effect)
    let i = 0;
    const timer = setInterval(() => {
      if (i < allBlocks.length) {
        setBlocks(prev => [...prev, allBlocks[i]]);
        i++;
      } else {
        clearInterval(timer);
      }
    }, 600); // 600ms between each sentence
  }

  /** Split text into short sentences for gradual reveal */
  function splitIntoSentences(text: string): string[] {
    const results: string[] = [];
    // Split by newlines first
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Split long lines by sentence endings (。！？)
      if (trimmed.length > 80) {
        const parts = trimmed.split(/(?<=[。！？])\s*/);
        for (const part of parts) {
          const p = part.trim();
          if (p) results.push(p);
        }
      } else {
        results.push(trimmed);
      }
    }
    return results;
  }

  // ===== Action Handlers =====

  const handleAction = useCallback(async (action: ActionSuggestion) => {
    if (isStreaming) return;
    add([{ id: bid(), type: 'action', source: 'reader', text: `（${action.label}）` }]);

    try {
      if (action.type === 'move') {
        if (phase === 'intro') {
          // First entry: call enter endpoint
          const res = await apiPost('/enter', { entryType: 'explore' });
          add([{ id: bid(), type: 'break', source: 'generated', text: '' }]);
          applyScene(res.data.scene);
          setPhase('world');
        } else {
          const res = await apiPost('/move', { locationId: action.params.locationId });
          add([{ id: bid(), type: 'break', source: 'generated', text: '' }]);
          applyScene(res.data.scene);
        }
      } else if (action.type === 'talk') {
        await handleTalk(action);
      } else if (action.type === 'observe') {
        const res = await apiPost('/observe');
        if (res.data?.text) {
          add([{ id: bid(), type: 'environment', source: 'generated', text: res.data.text }]);
        }
      } else if (action.type === 'time') {
        const res = await apiPost('/time-advance');
        add([{ id: bid(), type: 'break', source: 'generated', text: '' }]);
        applyScene(res.data.scene);
      } else if (action.type === 'perspective') {
        const mode = action.params.mode as PerspectiveMode;
        const labels: Record<string, string> = { protagonist: '主人公', character: 'あなた', omniscient: '俯瞰' };
        add([{ id: bid(), type: 'perspective_label', source: 'generated', text: `───── 視点: ${labels[mode] || mode} ─────` }]);
        const res = await apiPost('/perspective', { mode });
        applyScene(res.data.scene);
      }
    } catch (err: any) {
      add([{ id: bid(), type: 'environment', source: 'generated', text: '（接続エラー。もう一度試してください）' }]);
    }
  }, [isStreaming, phase, workId]);

  async function handleTalk(action: ActionSuggestion) {
    const charId = action.params.characterId;
    const message = action.params.message || 'こんにちは';
    const charName = worldState.presentCharacters.find(c => c.id === charId);
    const displayName = charName ? sn(charName.name) : '???';

    setIsStreaming(true);
    const dialogueId = bid();
    add([{ id: dialogueId, type: 'dialogue', source: 'generated', text: '', speaker: displayName, speakerColor: getCharColor(displayName) }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await api.fetchSSE(
        `/ai/character-talk/${workId}/chat`,
        { message, mode: 'character', characterId: charId, useSonnet: false },
        controller.signal,
      );

      await consumeSSEStream(response, (parsed) => {
        if (parsed.text) {
          setBlocks(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(b => b?.id === dialogueId);
            if (idx >= 0) updated[idx] = { ...updated[idx], text: updated[idx].text + parsed.text };
            return updated;
          });
        }
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      add([{ id: bid(), type: 'environment', source: 'generated', text: `（${displayName}は静かにこちらを見ている）` }]);
    } finally {
      setIsStreaming(false);
      // Refresh actions from backend (correct short names)
      try {
        const stateRes = await apiPost('/enter', { entryType: 'explore' });
        if (stateRes.data?.scene?.actions) {
          setWorldState(prev => ({
            ...prev,
            actions: stateRes.data.scene.actions.map((a: any) => ({ type: a.type, label: a.label, params: a.params || {} })),
          }));
        }
      } catch {}
    }
  }

  const handleFreeInput = useCallback(async (text: string) => {
    if (isStreaming) return;
    add([{ id: bid(), type: 'action', source: 'reader', text: `（${text}）` }]);

    // Check character names first
    for (const char of worldState.presentCharacters) {
      if (text.includes(sn(char.name))) {
        await handleTalk({ type: 'talk', label: '', params: { characterId: char.id, message: text } });
        return;
      }
    }

    // Default to observe
    try {
      const res = await apiPost('/observe');
      if (res.data?.text) add([{ id: bid(), type: 'environment', source: 'generated', text: res.data.text }]);
    } catch {}
  }, [isStreaming, worldState, workId]);

  const handlePerspectiveChange = useCallback((mode: PerspectiveMode) => {
    handleAction({ type: 'perspective', label: '', params: { mode } });
  }, [handleAction]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#55555f] text-sm tracking-widest animate-pulse">...</div>
      </div>
    );
  }

  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#d8d5d0] flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Noto Serif JP', serif" }}>
        <h1 className="text-2xl font-light tracking-widest mb-2">{work?.title || 'Interactive Novel'}</h1>
        <p className="text-xs text-[#55555f] mb-12">{work?.author?.displayName || work?.author?.name || ''}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              const saved = loadSession(workId);
              if (saved) { setBlocks(saved.blocks); setWorldState(saved.state); }
              setPhase('world');
            }}
            className="px-6 py-3 border border-[#2a2a35] rounded-lg text-sm text-[#d8d5d0] hover:border-[#4a4a55] transition-all cursor-pointer"
          >
            続きから
          </button>
          <button
            onClick={async () => {
              clearSession(workId);
              // Reset DB state too
              try { await apiPost('/reset'); } catch {}
              setBlocks([]);
              setWorldState({ locationId: null, locationName: '', timeOfDay: 'afternoon', timelinePosition: 0, perspective: 'character', presentCharacters: [], actions: [] });
              setPhase('intro');
            }}
            className="px-6 py-3 border border-[#2a2a35] rounded-lg text-sm text-[#8a8a95] hover:border-[#4a4a55] transition-all cursor-pointer"
          >
            最初から
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#d8d5d0] flex flex-col" style={{ fontFamily: "'Noto Serif JP', serif" }}>
      <ExperienceHeader state={worldState} onPerspectiveChange={handlePerspectiveChange} />
      <TheaterView blocks={blocks} isStreaming={isStreaming} />
      <ActionPalette actions={worldState.actions} onAction={handleAction} onFreeInput={handleFreeInput} disabled={isStreaming} />
    </div>
  );
}
