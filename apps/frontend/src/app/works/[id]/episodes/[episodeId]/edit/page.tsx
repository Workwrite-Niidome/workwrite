'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WritingEditor } from '@/components/editor/writing-editor';
import { api } from '@/lib/api';

export default function EditEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const workId = params.id as string;
  const episodeId = params.episodeId as string;
  const [episode, setEpisode] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEpisode(episodeId)
      .then((res) => setEpisode({ title: res.data.title, content: res.data.content }))
      .catch(() => router.push(`/works/${workId}/edit`))
      .finally(() => setLoading(false));
  }, [episodeId, workId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!episode) return null;

  return (
    <WritingEditor
      workId={workId}
      episodeId={episodeId}
      initialTitle={episode.title}
      initialContent={episode.content}
      onPublish={async (data) => {
        await api.updateEpisode(episodeId, data);
        router.push(`/works/${workId}/edit`);
      }}
    />
  );
}
