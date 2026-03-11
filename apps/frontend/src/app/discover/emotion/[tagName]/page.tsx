'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type Work } from '@/lib/api';
import { WorkCard, WorkCardSkeleton } from '@/components/work-card';

const TAG_LABELS: Record<string, string> = {
  courage: '勇気をもらいたい',
  tears: '泣きたい',
  worldview: '世界観を広げたい',
  healing: '癒されたい',
  excitement: 'ドキドキしたい',
  laughter: '笑いたい',
  awe: '畏怖を感じたい',
  nostalgia: '懐かしさに浸りたい',
  empathy: '共感したい',
  mystery: '謎を解きたい',
  growth: '成長を感じたい',
  catharsis: 'カタルシスを味わいたい',
  beauty: '美しさに触れたい',
  thrill: 'スリルを味わいたい',
  warmth: '温かさを感じたい',
};

export default function EmotionDiscoverPage() {
  const params = useParams();
  const tagName = params.tagName as string;
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWorksByEmotionTag(tagName)
      .then((res) => setWorks(res.data))
      .catch(() => setWorks([]))
      .finally(() => setLoading(false));
  }, [tagName]);

  const label = TAG_LABELS[tagName] || tagName;

  return (
    <div className="px-4 py-8">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2 min-h-[44px]">
            <ArrowLeft className="h-4 w-4 mr-1" /> トップへ戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{label}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          この感情タグが付けられた作品
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <WorkCardSkeleton key={i} />
          ))}
        </div>
      ) : works.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          まだこのタグの作品はありません
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}
    </div>
  );
}
