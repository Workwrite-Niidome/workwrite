'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScoreCard } from '@/components/scoring/score-card';
import { ShareScoreButton } from '@/components/scoring/share-score-button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Zap, Loader2, BookOpen, BarChart3, Globe, Pencil, Sparkles, ArrowRight } from 'lucide-react';

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    workId: string;
    title: string;
    episodes: number;
    scoringResult: any;
  } | null>(null);

  const isNarou = /ncode\.syosetu\.com/i.test(url);
  const isKakuyomu = /kakuyomu\.jp/i.test(url);
  const isValidUrl = isNarou || isKakuyomu;

  // Auto-run analysis after login redirect
  useEffect(() => {
    if (authLoading) return;
    const autorun = searchParams.get('autorun');
    if (autorun && isAuthenticated) {
      const savedUrl = sessionStorage.getItem('analyze_url');
      if (savedUrl) {
        sessionStorage.removeItem('analyze_url');
        setUrl(savedUrl);
        // Trigger analysis after state update
        setTimeout(() => {
          const el = document.getElementById('analyze-trigger');
          if (el) el.click();
        }, 100);
      }
    }
  }, [authLoading, isAuthenticated, searchParams]);

  async function handleAnalyze() {
    const targetUrl = url.trim();
    if (!targetUrl) return;
    if (!/ncode\.syosetu\.com/i.test(targetUrl) && !/kakuyomu\.jp/i.test(targetUrl)) return;

    if (!isAuthenticated) {
      // Save URL and redirect to login — analysis auto-triggers after login
      sessionStorage.setItem('analyze_url', targetUrl);
      router.push(`/login?redirect=${encodeURIComponent('/analyze?autorun=1')}`);
      return;
    }

    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await api.importFromUrl(targetUrl);
      setResult({
        workId: res.data.workId,
        title: res.data.title,
        episodes: res.data.episodes,
        scoringResult: res.data.scoringResult,
      });
    } catch (e: any) {
      setError(e?.message || '分析に失敗しました。URLを確認してください。');
    } finally {
      setImporting(false);
    }
  }

  const overallScore = result?.scoringResult?.overall ? Math.round(result.scoringResult.overall) : 0;
  const scoreLabel = overallScore >= 90 ? '傑作' : overallScore >= 80 ? '秀作' : overallScore >= 65 ? '良作' : overallScore >= 50 ? '佳作' : '';

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="px-4 py-16 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Zap className="h-4 w-4" />
          無料AI品質分析
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
          あなたの小説を<br />AIが分析します
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          小説家になろう・カクヨムのURLを入力するだけ。6つの軸でAIがスコアリングし、改善提案もお届けします。
        </p>

        {/* URL Input */}
        <div className="max-w-lg mx-auto space-y-3">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
              placeholder="https://ncode.syosetu.com/n1234ab/"
              className="flex-1 h-11"
            />
            <Button
              id="analyze-trigger"
              onClick={handleAnalyze}
              disabled={!isValidUrl || importing}
              size="lg"
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 分析中...</>
              ) : (
                <>分析する</>
              )}
            </Button>
          </div>
          {url && isValidUrl && (
            <p className="text-xs text-green-600">
              {isNarou ? '小説家になろう' : 'カクヨム'}の作品として検出
            </p>
          )}
          {url && !isValidUrl && url.length > 10 && (
            <p className="text-xs text-muted-foreground">
              小説家になろう (ncode.syosetu.com) またはカクヨム (kakuyomu.jp) のURLを入力してください
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </section>

      {/* Result */}
      {result && (
        <section className="px-4 pb-12 max-w-lg mx-auto space-y-4">
          {/* Score summary card */}
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-green-600 font-medium mb-1">分析完了</p>
              <p className="text-sm font-medium">{result.title}</p>
              <p className="text-xs text-muted-foreground">{result.episodes} エピソード</p>
            </CardContent>
          </Card>

          {/* Score Card */}
          {result.scoringResult && (
            <ScoreCard
              score={{
                immersion: result.scoringResult.immersion,
                transformation: result.scoringResult.transformation,
                virality: result.scoringResult.virality,
                worldBuilding: result.scoringResult.worldBuilding,
                characterDepth: result.scoringResult.characterDepth,
                structuralScore: result.scoringResult.structuralScore,
                overall: result.scoringResult.overall,
                analysis: result.scoringResult.analysis,
                tips: result.scoringResult.improvementTips,
                emotionTags: result.scoringResult.emotionTags,
                scoredAt: new Date().toISOString(),
                isImported: true,
              }}
              workId={result.workId}
              workTitle={result.title}
            />
          )}

          {/* Share CTA — prominent, immediately after score */}
          {result.scoringResult && (
            <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-purple-500/10 border-primary/20">
              <CardContent className="py-6 px-4 text-center space-y-3">
                <p className="text-lg font-bold">
                  {overallScore >= 80
                    ? `${scoreLabel}判定おめでとうございます！`
                    : overallScore >= 50
                    ? `${scoreLabel}！さらに磨ける可能性があります`
                    : 'スコアを確認しました！'}
                </p>
                <p className="text-sm text-muted-foreground">
                  あなたの結果をシェアして、他の作家にも診断を勧めてみましょう
                </p>
                <ShareScoreButton
                  workId={result.workId}
                  title={result.title}
                  score={result.scoringResult.overall}
                  variant="prominent"
                />
              </CardContent>
            </Card>
          )}

          {/* Workwrite tools CTA */}
          <Card className="border-dashed">
            <CardContent className="py-5 px-4 space-y-3">
              <p className="text-sm font-medium">改善提案を活かして作品を磨きませんか？</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <span><strong className="text-foreground">AI執筆アシスト</strong> — キャラ設定・世界観を踏まえた提案で、具体的に改善</span>
                </div>
                <div className="flex items-start gap-2">
                  <BarChart3 className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <span><strong className="text-foreground">詳細分析モード</strong> — キャラクター・プロットを登録すると、6軸の精度が大幅に向上</span>
                </div>
                <div className="flex items-start gap-2">
                  <BookOpen className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <span><strong className="text-foreground">読者に届く</strong> — 品質スコアで発見される。更新頻度に依存しない</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => router.push(`/works/${result.workId}/edit`)} className="flex-1 gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> 作品を編集する
                </Button>
                <Button variant="outline" onClick={() => router.push(`/works/${result.workId}`)} className="gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" /> 作品ページ
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Features */}
      {!result && (
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
                <Globe className="h-8 w-8 mx-auto mb-3 text-primary" />
                <p className="font-medium text-sm mb-1">URL入力だけ</p>
                <p className="text-xs text-muted-foreground">
                  小説家になろう・カクヨムのURLを貼るだけ。コピペ不要で即分析開始
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
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
