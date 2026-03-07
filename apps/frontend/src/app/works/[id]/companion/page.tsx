'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompanionChat } from '@/components/ai/companion-chat';

export default function CompanionPage() {
  const params = useParams();
  const workId = params.id as string;

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
        <CompanionChat workId={workId} />
      </div>
    </div>
  );
}
