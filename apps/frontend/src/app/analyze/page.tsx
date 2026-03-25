'use client';

import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { Zap, BookOpen, BarChart3, Sparkles, ArrowRight } from 'lucide-react';

function AnalyzeContent() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="px-4 py-16 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Zap className="h-4 w-4" />
          AI品質分析
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
          あなたの小説を<br />AIが分析します
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Workwriteに投稿した作品をAIが6つの軸でスコアリングし、改善提案もお届けします。
        </p>

        <div className="max-w-lg mx-auto">
          <Button
            onClick={() => {
              if (isAuthenticated) {
                router.push('/dashboard');
              } else {
                router.push('/login?redirect=/dashboard');
              }
            }}
            size="lg"
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            {isAuthenticated ? 'ダッシュボードへ' : 'ログインして作品を分析'}
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-16 max-w-3xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-6 px-4 text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="font-medium text-sm mb-1">6軸スコアリング</p>
              <p className="text-xs text-muted-foreground">
                没入力・変容力・拡散力・世界構築力・キャラクター深度・構造スコアで多角的に評価
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 px-4 text-center">
              <Zap className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="font-medium text-sm mb-1">改善提案付き</p>
              <p className="text-xs text-muted-foreground">
                AIが具体的な改善ポイントを3つ提案。作品をさらに磨く手がかりに
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 px-4 text-center">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="font-medium text-sm mb-1">作品を投稿して分析</p>
              <p className="text-xs text-muted-foreground">
                Workwriteに作品を投稿するだけで、自動的にAI品質分析が実行されます
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AnalyzeContent />
    </Suspense>
  );
}
