'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { ExperienceScript, ScriptBlock, ScriptAwareness } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const DELAYS: Record<string, number> = {
  original: 2200,
  environment: 2000,
  dialogue: 1800,
  memory: 2200,
  'scene-break': 1200,
  'reader-action': 300,
};

const INTRO_DELAYS = [2000, 2500, 2500, 2800, 2500];

// Unified timeline item: either a block or an awareness
type TimelineItem =
  | { kind: 'block'; id: string; block: ScriptBlock; visible: boolean }
  | { kind: 'awareness'; id: string; awareness: ScriptAwareness; visible: boolean; clicked: boolean };

export default function ExperiencePage() {
  const { workId } = useParams<{ workId: string }>();
  const [script, setScript] = useState<ExperienceScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [headerText, setHeaderText] = useState('');
  const [headerVisible, setHeaderVisible] = useState(false);

  const pendingResolveRef = useRef<(() => void) | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockIdRef = useRef(0);
  // Track where to insert next items (after which item id)
  const insertAfterRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workId) return;
    fetch(`${API_BASE}/interactive-novel/${workId}/experience`)
      .then(r => r.json())
      .then(data => {
        const d = data?.data || data;
        if (d?.script) {
          setScript(d.script as ExperienceScript);
        } else {
          setError('体験はまだ準備されていません');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('体験の読み込みに失敗しました');
        setLoading(false);
      });
  }, [workId]);

  // Tap to skip
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-awareness]') || target.closest('a')) return;
      if (pendingResolveRef.current) {
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        const fn = pendingResolveRef.current;
        pendingResolveRef.current = null;
        pendingTimerRef.current = null;
        fn();
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const wait = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => {
      pendingResolveRef.current = resolve;
      pendingTimerRef.current = setTimeout(() => {
        pendingResolveRef.current = null;
        pendingTimerRef.current = null;
        resolve();
      }, ms);
    });
  }, []);

  // Insert an item into the timeline, after insertAfterRef or at the end
  const insertItem = useCallback((item: TimelineItem) => {
    setTimeline(prev => {
      const insertAfter = insertAfterRef.current;
      if (!insertAfter) return [...prev, item];
      const idx = prev.findIndex(i => i.id === insertAfter);
      if (idx === -1) return [...prev, item];
      const next = [...prev];
      next.splice(idx + 1, 0, item);
      return next;
    });
    insertAfterRef.current = item.id;
  }, []);

  const makeVisible = useCallback((id: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeline(prev => prev.map(i => i.id === id ? { ...i, visible: true } : i));
      });
    });
  }, []);

  const addBlock = useCallback(async (block: ScriptBlock, delay: number) => {
    const id = `b-${++blockIdRef.current}`;
    await wait(delay);
    insertItem({ kind: 'block', id, block, visible: false });
    makeVisible(id);
  }, [wait, insertItem, makeVisible]);

  const addAwareness = useCallback(async (awareness: ScriptAwareness, delay: number) => {
    const id = `a-${++blockIdRef.current}`;
    await wait(delay);
    insertItem({ kind: 'awareness', id, awareness, visible: false, clicked: false });
    makeVisible(id);
  }, [wait, insertItem, makeVisible]);

  const showHeader = useCallback((text: string) => {
    setHeaderText(text);
    setHeaderVisible(true);
    setTimeout(() => setHeaderVisible(false), 5000);
  }, []);

  const playScene = useCallback(async (sceneId: string) => {
    if (!script) return;
    const scene = script.scenes[sceneId];
    if (!scene) return;

    if (scene.header) showHeader(scene.header);

    for (const block of scene.blocks) {
      await addBlock(block, DELAYS[block.type] || 1800);
    }

    if (scene.continues) {
      await wait(2000);
      await playScene(scene.continues);
    } else if (scene.awareness && scene.awareness.length > 0) {
      for (let i = 0; i < scene.awareness.length; i++) {
        await addAwareness(scene.awareness[i], i === 0 ? 3000 : 1000);
      }
    }
  }, [script, addBlock, addAwareness, showHeader, wait]);

  const handleAwarenessClick = useCallback((id: string, awareness: ScriptAwareness) => {
    // Mark as clicked
    setTimeline(prev => prev.map(i =>
      i.id === id && i.kind === 'awareness' ? { ...i, clicked: true } : i
    ));
    // Set insertion point to right after this awareness
    insertAfterRef.current = id;
    playScene(awareness.target);
  }, [playScene]);

  // Start experience
  useEffect(() => {
    if (!script) return;
    insertAfterRef.current = null;

    const run = async () => {
      for (let i = 0; i < script.intro.blocks.length; i++) {
        await addBlock(script.intro.blocks[i], INTRO_DELAYS[i] || 2000);
      }
      // Handle both object and array forms of intro awareness
      const introAwareness = Array.isArray(script.intro.awareness)
        ? script.intro.awareness
        : [script.intro.awareness];
      for (let i = 0; i < introAwareness.length; i++) {
        await addAwareness(introAwareness[i], i === 0 ? 3500 : 1000);
      }
    };
    run();
  }, [script, addBlock, addAwareness]);

  if (loading) {
    return (
      <div style={{
        background: '#0a0a0f', minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 3, height: 3, borderRadius: '50%', background: '#2a2a35',
          animation: 'breathe 4s ease-in-out infinite',
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#0a0a0f', minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#55555f', fontFamily: 'sans-serif', fontSize: 14,
      }}>
        {error}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400&display=swap');
        @keyframes breathe { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.6; } }
        @keyframes awarenessGlow { 0% { color: #4a4a55; } 50% { color: #6a6a75; } 100% { color: #4a4a55; } }
      `}</style>

      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        textAlign: 'center', padding: 16, fontSize: 11, color: '#55555f',
        letterSpacing: '0.15em',
        background: 'linear-gradient(to bottom, #0a0a0f 60%, transparent)',
        opacity: headerVisible ? 1 : 0,
        transition: 'opacity 0.8s',
        pointerEvents: 'none',
        fontFamily: 'sans-serif',
      }}>
        {headerText}
      </div>

      <div style={{
        maxWidth: 640, margin: '0 auto', padding: '80px 24px 160px',
        minHeight: '100vh',
      }}>
        {timeline.map(item => {
          if (item.kind === 'block') {
            return <BlockRenderer key={item.id} id={item.id} block={item.block} visible={item.visible} />;
          }
          return (
            <AwarenessRenderer
              key={item.id}
              id={item.id}
              awareness={item.awareness}
              visible={item.visible}
              clicked={item.clicked}
              onClick={() => !item.clicked && handleAwarenessClick(item.id, item.awareness)}
            />
          );
        })}
      </div>

      <div style={{
        position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        width: 3, height: 3, borderRadius: '50%', background: '#2a2a35',
        animation: 'breathe 4s ease-in-out infinite',
      }} />
    </>
  );
}

function BlockRenderer({ id, block, visible }: { id: string; block: ScriptBlock; visible: boolean }) {
  const base: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    transition: 'opacity 1.5s ease-out, transform 1.5s ease-out',
    fontFamily: "'Noto Serif JP', serif",
    fontWeight: 300,
  };

  if (block.type === 'scene-break') {
    return (
      <div id={id} style={{
        ...base, textAlign: 'center', color: '#3a3a40', fontSize: 14,
        letterSpacing: '0.5em', padding: '40px 0',
      }}>
        * * *
      </div>
    );
  }

  if (block.type === 'reader-action') {
    return <div id={id} style={{ ...base, padding: '16px 0' }} />;
  }

  if (block.type === 'dialogue') {
    return (
      <div id={id} style={{ ...base, padding: '12px 0 12px 20px', fontSize: 15, lineHeight: 2.2, color: '#d8d5d0' }}>
        {block.speaker && (
          <div style={{
            fontFamily: 'sans-serif', fontSize: 11, letterSpacing: '0.1em',
            marginBottom: 4, color: block.speakerColor || '#8a8a95',
          }}>
            {block.speaker}
          </div>
        )}
        <div style={{
          ...(block.speaker ? {
            borderLeft: `2px solid ${(block.speakerColor || '#8a7a6a')}33`,
            paddingLeft: 16,
          } : {}),
        }}>
          {block.text}
        </div>
      </div>
    );
  }

  if (block.type === 'memory') {
    return (
      <div id={id} style={{
        ...base, color: '#3a3a40', fontSize: 15, lineHeight: 2.2,
        textIndent: '1em', padding: '8px 0',
        fontStyle: 'italic', filter: 'blur(0.3px)',
      }}>
        {block.text}
      </div>
    );
  }

  if (block.type === 'environment') {
    return (
      <div id={id} style={{
        ...base, color: '#a8a5a0', fontSize: 15, lineHeight: 2.2,
        textIndent: '1em', padding: '12px 0',
      }}>
        {block.text}
      </div>
    );
  }

  return (
    <div id={id} style={{
      ...base, color: '#d8d5d0', fontSize: 15, lineHeight: 2.2,
      textIndent: '1em', padding: '12px 0',
    }}>
      {block.text}
    </div>
  );
}

function AwarenessRenderer({
  id, awareness, visible, clicked, onClick,
}: {
  id: string;
  awareness: ScriptAwareness;
  visible: boolean;
  clicked: boolean;
  onClick: () => void;
}) {
  return (
    <div
      id={id}
      data-awareness="true"
      onClick={onClick}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 1.5s ease-out, transform 1.5s ease-out, color 0.6s ease',
        color: clicked ? '#55555f' : '#4a4a55',
        fontSize: 14,
        lineHeight: 2,
        padding: '20px 0 8px',
        cursor: clicked ? 'default' : 'pointer',
        userSelect: 'none',
        borderBottom: '1px solid transparent',
        display: 'inline-block',
        fontFamily: "'Noto Serif JP', serif",
        fontWeight: 300,
        pointerEvents: clicked ? 'none' : 'auto',
        animation: visible && !clicked ? 'awarenessGlow 3s ease-in-out 1.5s 1' : 'none',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!clicked) {
          (e.target as HTMLElement).style.color = '#8a8a95';
          (e.target as HTMLElement).style.borderBottomColor = '#3a3a45';
        }
      }}
      onMouseLeave={e => {
        if (!clicked) {
          (e.target as HTMLElement).style.color = '#4a4a55';
          (e.target as HTMLElement).style.borderBottomColor = 'transparent';
        }
      }}
    >
      <span style={{ letterSpacing: '0.3em', marginRight: '0.5em' }}>......</span>
      {awareness.text}
    </div>
  );
}
