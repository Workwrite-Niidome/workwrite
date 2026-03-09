'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { readTextFile } from '@/lib/file-reader';
import { Upload, FileText, ChevronRight, ChevronLeft, Pencil, Loader2 } from 'lucide-react';

interface DetectedChapter {
  title: string;
  content: string;
  startLine: number;
}

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState('');
  const [chapters, setChapters] = useState<DetectedChapter[]>([]);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

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

  function updateChapterTitle(index: number, newTitle: string) {
    setChapters((prev) => prev.map((c, i) => i === index ? { ...c, title: newTitle } : c));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">作品インポート</h1>
      <p className="text-sm text-muted-foreground mb-6">
        他サイトで書いた作品をテキストから取り込めます。
      </p>

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

      {error && <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>}

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
    </div>
  );
}
