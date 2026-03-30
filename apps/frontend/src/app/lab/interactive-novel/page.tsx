'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Work, Episode, StoryCharacter } from '@/lib/api';
import { InteractiveLanding } from './components/landing';
import { LayerRead } from './components/layer-read';
import { LayerParticipate } from './components/layer-participate';
import { LayerImmerse } from './components/layer-immerse';
import { LayerConnect } from './components/layer-connect';
import { LayerExperience } from './components/layer-experience';

export type Layer = 'landing' | 'read' | 'participate' | 'immerse' | 'connect' | 'experience';

export interface WorkData {
  work: Work;
  episodes: Episode[];
  characters: StoryCharacter[];
  creationPlan: any;
}

export default function InteractiveNovelLab() {
  const [layer, setLayer] = useState<Layer>('landing');
  const [workId, setWorkId] = useState<string>('');
  const [data, setData] = useState<WorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find Aria work on mount
  useEffect(() => {
    async function loadAria() {
      try {
        // Try to find Aria from user's works
        const worksRes = await api.getMyWorks();
        const works = (worksRes as any)?.data ?? worksRes;
        const ariaWork = Array.isArray(works)
          ? works.find((w: Work) => w.title === 'アリア' || w.title === 'Aria')
          : null;

        if (!ariaWork) {
          setError('作品「Aria」が見つかりません。先にWorkwriteに作品を登録してください。');
          setLoading(false);
          return;
        }

        setWorkId(ariaWork.id);

        // Load all data in parallel
        const [episodesRes, charactersRes, planRes] = await Promise.all([
          api.getEpisodes(ariaWork.id).catch(() => null),
          api.getCharacters(ariaWork.id).catch(() => null),
          api.getCreationPlan(ariaWork.id).catch(() => null),
        ]);

        const episodes = ((episodesRes as any)?.data ?? episodesRes ?? []) as Episode[];
        const characters = ((charactersRes as any)?.data ?? charactersRes ?? []) as StoryCharacter[];
        const plan = (planRes as any)?.data ?? planRes ?? null;

        setData({
          work: ariaWork,
          episodes: episodes.sort((a, b) => a.orderIndex - b.orderIndex),
          characters,
          creationPlan: plan,
        });
      } catch (e) {
        setError('データの読み込みに失敗しました。ログインしているか確認してください。');
      } finally {
        setLoading(false);
      }
    }
    loadAria();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <p className="text-sm text-[#55555f] tracking-widest">LOADING...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4">
        <div className="text-center">
          <p className="text-sm text-[#8a8a95] mb-4">{error}</p>
          <p className="text-xs text-[#55555f]">URL: /lab/interactive-novel</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e6e3]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
      {layer === 'landing' && (
        <InteractiveLanding data={data} onSelectLayer={setLayer} />
      )}
      {layer === 'read' && (
        <LayerRead data={data} onBack={() => setLayer('landing')} />
      )}
      {layer === 'participate' && (
        <LayerParticipate data={data} onBack={() => setLayer('landing')} />
      )}
      {layer === 'immerse' && (
        <LayerImmerse data={data} onBack={() => setLayer('landing')} />
      )}
      {layer === 'connect' && (
        <LayerConnect data={data} onBack={() => setLayer('landing')} />
      )}
      {layer === 'experience' && (
        <LayerExperience data={data} onBack={() => setLayer('landing')} />
      )}
    </div>
  );
}
