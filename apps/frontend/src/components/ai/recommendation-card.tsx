import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { AiRecommendation } from '@/lib/api';

export function RecommendationCard({ rec }: { rec: AiRecommendation }) {
  return (
    <Link href={`/works/${rec.work.id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <h3 className="font-medium text-sm">{rec.work.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rec.work.author.displayName || rec.work.author.name}
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">
            {rec.reason}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
