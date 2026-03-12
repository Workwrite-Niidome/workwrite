'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function BillingCancelPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-bold mb-2">{'\u30C1\u30A7\u30C3\u30AF\u30A2\u30A6\u30C8\u304C\u30AD\u30E3\u30F3\u30BB\u30EB\u3055\u308C\u307E\u3057\u305F'}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {'\u6C7A\u6E08\u306F\u5B8C\u4E86\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u3044\u3064\u3067\u3082\u518D\u5EA6\u304A\u8A66\u3057\u3044\u305F\u3060\u3051\u307E\u3059\u3002'}
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/settings/billing">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-3 w-3" />
              {'\u8AB2\u91D1\u8A2D\u5B9A\u306B\u623B\u308B'}
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="sm">{'\u6599\u91D1\u30D7\u30E9\u30F3\u3092\u898B\u308B'}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
