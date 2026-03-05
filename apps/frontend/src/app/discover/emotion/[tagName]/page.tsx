'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type Work } from '@/lib/api';

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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> トップへ戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{label}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          この感情タグが付けられた作品
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : works.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          まだこのタグの作品はありません
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {works.map((work) => (
            <Link key={work.id} href={`/works/${work.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-medium text-sm line-clamp-2">{work.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {work.author.displayName || work.author.name}
                  </p>
                  {work.synopsis && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{work.synopsis}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {work.qualityScore && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-0.5" />
                        {Math.round(work.qualityScore.overall)}
                      </Badge>
                    )}
                    {work.genre && (
                      <Badge variant="outline" className="text-xs">{work.genre}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
