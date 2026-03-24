'use client';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CharacterTalkChat } from '@/components/ai/character-talk-chat';

export default function CharacterTalkPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workId = params.id as string;
  const characterId = searchParams.get('characterId') || undefined;
  const message = searchParams.get('message') || undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <Link href={`/works/${workId}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" /> 作品へ戻る
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <CharacterTalkChat
          workId={workId}
          initialCharacterId={characterId}
          initialMessage={message}
        />
      </div>
    </div>
  );
}
