'use client';

import { useParams } from 'next/navigation';
import { WritingEditor } from '@/components/editor/writing-editor';

export default function NewEpisodePage() {
  const params = useParams();
  const workId = params.id as string;

  return <WritingEditor workId={workId} />;
}
