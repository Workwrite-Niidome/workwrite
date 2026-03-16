'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { readTextFile } from '@/lib/file-reader';
import { ScoreCard } from '@/components/scoring/score-card';
import { ShareScoreButton } from '@/components/scoring/share-score-button';
import { Upload, FileText, ChevronRight, ChevronLeft, Pencil, Loader2, Link, Globe, Info, AlertTriangle } from 'lucide-react';

interface DetectedChapter {
  title: string;
  content: string;
  startLine: number;
}

type ImportMode = 'text' | 'url';

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common state
  const [mode, setMode] = useState<ImportMode>('url');
  const [error, setError] = useState('');

  // Text import state
  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState('');
  const [chapters, setChapters] = useState<DetectedChapter[]>([]);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);

  // URL import state
  const [importUrl, setImportUrl] = useState('');
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlResult, setUrlResult] = useState<{
    workId: string;
    title: string;
    episodes: number;
    scoringResult: any;
  } | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readTextFile(file);
      setRawText(text);
      const name = file.name.replace(/\.(txt|md)$/i, '');
      if (!title) setTitle(name);
    } catch {
      setError('ファイルの読み込みに失敗しました');
    }
  }

  async function handleAnalyze() {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    setError('');
    try {
      const res = await api.analyzeImportText(rawText);
      setChapters(res.data.chapters);
      setStep(2);
    } catch {
      setError('テキストの解析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError('');
    try {
      const res = await api.importWork({
        title,
        synopsis: synopsis || undefined,
        genre: genre || undefined,
        chapters: chapters.map((c) => ({ title: c.title, content: c.content })),
      });
      router.push(`/works/${res.data.workId}/edit`);
    } catch {
      setError('インポートに失敗しました');
    } finally {
      setImporting(false);
    }
  }

  async function handleUrlImport() {
    if (!importUrl.trim()) return;
    setUrlImporting(true);
    setError('');
    setUrlResult(null);
    try {
      const res = await api.importFromUrl(importUrl.trim());
      setUrlResult({
        workId: res.data.workId,
        title: res.data.title,
        episodes: res.data.episodes,
        scoringResult: res.data.scoringResult,
      });
    } catch (e: any) {
      setError(e?.message || 'インポートに失敗しました。URLを確認してください。');
    } finally {
      setUrlImporting(false);
    }
  }

  function updateChapterTitle(index: number, newTitle: string) {
    setChapters((prev) => prev.map((c, i) => i === index ? { ...c, title: newTitle } : c));
  }

  const isNarouUrl = /ncode\.syosetu\.com/i.test(importUrl);
  const isKakuyomuUrl = /kakuyomu\.jp/i.test(importUrl);
  const detectedPlatform = isNarouUrl ? 'なろう' : isKakuyomuUrl ? 'カクヨム' : null;

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">作品インポート</h1>
      <p className="text-sm text-muted-foreground mb-6">
        他サイトの作品をURL or テキストから取り込み、AIが品質を分析します。
      </p>

      {/* Mode tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => { setMode('url'); setError(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'url' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="h-4 w-4 inline mr-1.5" />
          URLから取り込み
        </button>
        <button
          onClick={() => { setMode('text'); setError(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'text' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-1.5" />
          テキスト貼り付け
        </button>
      </div>

      {error && <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>}

      {/* ============= URL Import Mode ============= */}
      {mode === 'url' && !urlResult && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">作品URL</label>
            <div className="flex gap-2">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://ncode.syosetu.com/n1234ab/ or https://kakuyomu.jp/works/..."
                className="flex-1"
              />
            </div>
            {detectedPlatform && (
              <p className="text-xs text-green-600">
                {detectedPlatform}の作品として検出されました
              </p>
            )}
          </div>

          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-sm font-medium mb-1">対応サイト</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>・小説家になろう（ncode.syosetu.com）</li>
                <li>・カクヨム（kakuyomu.jp）</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                取り込み後、AIが自動で品質スコアリングを実行します（1クレジット消費）
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-900 space-y-1.5">
                  <p className="font-medium text-sm">AIスコアリングについて</p>
                  <p>
                    本機能はAI（Claude）が作品の文体・構成・キャラクター・世界観などを構造的に分析し、
                    6つの軸で0〜100点のスコアを算出するものです。
                    冒頭・中盤・クライマックス・結末の4箇所をサンプリングし、
                    伏線回収率や感情弧の推移などの構造データと合わせて総合的に評価します。
                  </p>
                  <p>
                    スコアはAIによる参考指標であり、作品の絶対的な価値を定めるものではありません。
                    創作の振り返りや改善のヒントとしてご活用ください。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-medium text-sm">ご利用上の注意</p>
                  <p>
                    本機能はご自身の作品の分析を目的としています。
                    他者の作品を無断でスコアリング・公開する行為は推奨しません。
                    第三者の作品をスコアリングした結果の利用・公開に関して、
                    当サービスは一切の責任を負いません。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleUrlImport}
              disabled={!importUrl.trim() || urlImporting || (!isNarouUrl && !isKakuyomuUrl)}
            >
              {urlImporting ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 取り込み中（数分かかる場合があります）...</>
              ) : (
                <><Link className="h-4 w-4 mr-1.5" /> 取り込み開始</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* URL Import Result */}
      {mode === 'url' && urlResult && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-green-600 font-medium mb-2">インポート完了</p>
              <p className="text-sm">「{urlResult.title}」 — {urlResult.episodes} エピソード</p>
            </CardContent>
          </Card>

          {urlResult.scoringResult && (
            <ScoreCard
              score={{
                immersion: urlResult.scoringResult.immersion,
                transformation: urlResult.scoringResult.transformation,
                virality: urlResult.scoringResult.virality,
                worldBuilding: urlResult.scoringResult.worldBuilding,
                characterDepth: urlResult.scoringResult.characterDepth,
                structuralScore: urlResult.scoringResult.structuralScore,
                overall: urlResult.scoringResult.overall,
                analysis: urlResult.scoringResult.analysis,
                tips: urlResult.scoringResult.improvementTips,
                emotionTags: urlResult.scoringResult.emotionTags,
                scoredAt: new Date().toISOString(),
              }}
            />
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={() => router.push(`/works/${urlResult.workId}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" /> 作品を編集
            </Button>
            <Button variant="outline" onClick={() => router.push(`/works/${urlResult.workId}`)}>
              作品を見る
            </Button>
            {urlResult.scoringResult && (
              <ShareScoreButton
                workId={urlResult.workId}
                title={urlResult.title}
                score={urlResult.scoringResult.overall}
              />
            )}
            <Button
              variant="outline"
              onClick={() => {
                setUrlResult(null);
                setImportUrl('');
              }}
            >
              別の作品を取り込む
            </Button>
          </div>
        </div>
      )}

      {/* ============= Text Import Mode ============= */}
      {mode === 'text' && (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { n: 1, label: 'テキスト入力' },
              { n: 2, label: 'チャプター確認' },
              { n: 3, label: '作品情報' },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    step >= s.n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.n}
                </div>
                <span className={`text-sm ${step >= s.n ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
                {s.n < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>

          {/* Step 1: Input */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">タイトル</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="作品タイトル" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">テキスト</label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="作品のテキストを貼り付けてください..."
                  rows={16}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1.5" /> ファイルから読込
                </Button>
                <span className="text-xs text-muted-foreground">.txt / .md（UTF-8・Shift-JIS対応）</span>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleAnalyze} disabled={!rawText.trim() || !title.trim() || analyzing}>
                  {analyzing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 解析中...</> : <>次へ <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Chapter preview */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {chapters.length} 個のチャプターが検出されました。タイトルを編集できます。
              </p>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {chapters.map((ch, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground shrink-0 w-6">{i + 1}.</span>
                        <Input
                          value={ch.title}
                          onChange={(e) => updateChapterTitle(i, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="ml-8 text-xs text-muted-foreground">
                        {ch.content.length.toLocaleString()} 文字
                        <span className="mx-2">|</span>
                        <span className="truncate">{ch.content.slice(0, 80)}...</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> 戻る
                </Button>
                <Button onClick={() => setStep(3)}>
                  次へ <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm & Import */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">タイトル</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">あらすじ</label>
                <Textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  rows={3}
                  placeholder="あらすじ（任意）"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ジャンル</label>
                <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="例: ファンタジー、ミステリー" />
              </div>

              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-sm font-medium mb-1">インポート内容</p>
                  <p className="text-xs text-muted-foreground">
                    {chapters.length} エピソード、合計 {chapters.reduce((acc, c) => acc + c.content.length, 0).toLocaleString()} 文字
                  </p>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> 戻る
                </Button>
                <Button onClick={handleImport} disabled={importing || !title.trim()}>
                  {importing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> インポート中...</> : <><FileText className="h-4 w-4 mr-1.5" /> インポート実行</>}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
