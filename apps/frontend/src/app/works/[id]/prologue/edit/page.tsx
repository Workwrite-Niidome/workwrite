'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WritingEditor } from '@/components/editor/writing-editor';
import { api } from '@/lib/api';

export default function EditProloguePage() {
  const params = useParams();
  const router = useRouter();
  const workId = params.id as string;
  const [prologueContent, setPrologueContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWork(workId)
      .then((res) => setPrologueContent(res.data.prologue || ''))
      .catch(() => router.push(`/works/${workId}/edit`))
      .finally(() => setLoading(false));
  }, [workId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (prologueContent === null) return null;

  return (
    <WritingEditor
      workId={workId}
      initialTitle="序章"
      initialContent={prologueContent}
      onPublish={async (data) => {
        await api.updateWork(workId, { prologue: data.content } as any);
        router.push(`/works/${workId}/edit`);
      }}
    />
  );
}
