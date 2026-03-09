'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/layout/loading';
import { api, type Work, type Episode } from '@/lib/api';
import { ArrowLeft, ChevronRight, Eye } from 'lucide-react';

export default function PreviewPage() {
  const params = useParams();
  const workId = params.id as string;
  const [work, setWork] = useState<Work | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  useEffect(() => {
    Promise.all([
      api.getWork(workId),
      api.getEpisodes(workId),
    ]).then(([workRes, epsRes]) => {
      setWork(workRes.data);
      setEpisodes(epsRes.data as Episode[]);
    }).catch(() => {});
  }, [workId]);

  if (!work) return <Loading />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Link href={`/works/${workId}/edit`}>
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> 編集に戻る</Button>
            </Link>
            <Badge variant="outline" className="text-xs">
              <Eye className="h-3 w-3 mr-1" /> プレビュー
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {!selectedEpisode ? (
          /* Work overview */
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-bold">{work.title}</h1>
              <p className="text-muted-foreground">{work.author?.displayName || work.author?.name}</p>
              {work.genre && <Badge variant="secondary">{work.genre}</Badge>}
            </div>

            {work.synopsis && (
              <div className="bg-muted/30 rounded-lg p-6">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{work.synopsis}</p>
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">目次</h2>
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => {
                    api.getEpisode(ep.id).then((res) => setSelectedEpisode(res.data)).catch(() => {});
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm text-muted-foreground">{ep.orderIndex + 1}</span>
                    <span className="text-sm font-medium truncate">{ep.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                    <span className="text-xs">{ep.wordCount.toLocaleString()} 字</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Episode view */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedEpisode(null)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 目次に戻る
            </button>

            <div className="text-center space-y-2 pb-6 border-b">
              <p className="text-xs text-muted-foreground">第{selectedEpisode.orderIndex + 1}話</p>
              <h1 className="text-2xl font-bold">{selectedEpisode.title}</h1>
            </div>

            <div
              className="prose prose-stone dark:prose-invert max-w-none whitespace-pre-wrap text-base leading-[2] tracking-wide"
              style={{ fontFamily: '"Noto Serif JP", "游明朝", "YuMincho", serif' }}
            >
              {selectedEpisode.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
