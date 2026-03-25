'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, ArrowLeft, ArrowUp, ArrowDown, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';
import { api, type Work } from '@/lib/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MULTI_FILES = 100;

const GENRES = [
  { key: 'fantasy', label: 'ファンタジー' },
  { key: 'sf', label: 'SF・近未来' },
  { key: 'modern', label: '現代・日常' },
  { key: 'historical', label: '歴史・時代' },
  { key: 'romance', label: '恋愛' },
  { key: 'mystery', label: 'ミステリー' },
  { key: 'horror', label: 'ホラー' },
  { key: 'action', label: 'アクション' },
  { key: 'drama', label: 'ヒューマンドラマ' },
  { key: 'comedy', label: 'コメディ' },
  { key: 'adventure', label: '冒険' },
  { key: 'literary', label: '文芸' },
  { key: 'thriller', label: 'サスペンス' },
];

type ImportMode = 'single' | 'multiple';
type TargetMode = 'new' | 'existing';

interface AnalyzeResult {
  chapters: { title: string; content: string; startLine: number }[];
  detectedEncoding: string;
  totalCharacters: number;
}

interface ImportResult {
  importId: string;
  workId: string;
  episodeCount: number;
}

export default function ImportPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<ImportMode>('single');

  // Step 1: files
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: preview
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Step 3: settings
  const [targetMode, setTargetMode] = useState<TargetMode>('new');
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const [myWorks, setMyWorks] = useState<Work[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [importing, setImporting] = useState(false);

  // Step 4: result
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Auth guard
  if (!authLoading && !isAuthenticated) {
    router.push('/login');
    return null;
  }

  const validateFiles = (incoming: File[]): string | null => {
    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE) {
        return `ファイル「${f.name}」が10MBを超えています。`;
      }
      if (!f.name.endsWith('.txt') && !f.name.endsWith('.text')) {
        return `ファイル「${f.name}」はテキストファイルではありません。.txt ファイルを選択してください。`;
      }
    }
    if (mode === 'single' && incoming.length > 1) {
      return '一括インポートモードでは1ファイルのみ選択できます。';
    }
    if (mode === 'multiple' && incoming.length > MAX_MULTI_FILES) {
      return `最大${MAX_MULTI_FILES}ファイルまで選択できます。`;
    }
    return null;
  };

  const handleFiles = useCallback(async (incoming: File[]) => {
    const error = validateFiles(incoming);
    if (error) {
      toast(error, 'error');
      return;
    }
    setFiles(incoming);
    setAnalyzeError(null);

    // Auto-advance to step 2
    if (mode === 'single' && incoming.length === 1) {
      setAnalyzing(true);
      setStep(2);
      try {
        const result = await api.analyzeImportFile(incoming[0]);
        setAnalyzeResult(result);
      } catch (e: any) {
        setAnalyzeError(e.message || 'ファイルの解析に失敗しました');
      } finally {
        setAnalyzing(false);
      }
    } else if (mode === 'multiple' && incoming.length > 0) {
      setStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) handleFiles(dropped);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) handleFiles(selected);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }, [handleFiles]);

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...files];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newFiles.length) return;
    [newFiles[index], newFiles[swapIndex]] = [newFiles[swapIndex], newFiles[index]];
    setFiles(newFiles);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const goToStep3 = async () => {
    setStep(3);
    // Pre-fill title from filename if new work
    if (!title && files.length > 0) {
      const name = files[0].name.replace(/\.(txt|text)$/, '');
      setTitle(name);
    }
    // Load user's works for "existing" option
    if (myWorks.length === 0) {
      setLoadingWorks(true);
      try {
        const res = await api.getMyWorks();
        setMyWorks(res.data || []);
      } catch {
        // Silently fail; user can still create new
      } finally {
        setLoadingWorks(false);
      }
    }
  };

  const handleImport = async () => {
    if (targetMode === 'new' && !title.trim()) {
      toast('タイトルを入力してください。', 'error');
      return;
    }
    if (targetMode === 'existing' && !selectedWorkId) {
      toast('作品を選択してください。', 'error');
      return;
    }

    setImporting(true);
    try {
      const options: { workId?: string; title?: string; synopsis?: string; genre?: string } = {};
      if (targetMode === 'new') {
        options.title = title.trim();
        if (synopsis.trim()) options.synopsis = synopsis.trim();
        if (genre) options.genre = genre;
      } else {
        options.workId = selectedWorkId;
      }

      let result: ImportResult;
      if (mode === 'single') {
        result = await api.importFile(files[0], options);
      } else {
        result = await api.importMultipleFiles(files, options);
      }
      setImportResult(result);
      setStep(4);
      toast('インポートが完了しました！', 'success');
    } catch (e: any) {
      toast(e.message || 'インポートに失敗しました。', 'error');
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">テキストファイルのインポート</h1>

      {step === 1 && (
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border space-y-2">
          <p className="text-sm text-foreground font-medium">使い方</p>
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p><span className="font-medium text-foreground">一括インポート:</span> 1つのテキストファイルから章（「第○章」「Chapter」等）を自動検出し、複数エピソードに分割して取り込みます。長編小説をまとめて登録したい場合に便利です。</p>
            <p><span className="font-medium text-foreground">複数ファイルインポート:</span> 複数のテキストファイル（最大100件）をまとめてアップロードし、各ファイルを1エピソードとして取り込みます。エピソードごとにファイルを分けている場合に便利です。</p>
            <p>対応形式: .txt（UTF-8、Shift_JIS等のエンコーディングを自動検出）、各ファイル最大10MB</p>
            <p>新規作品として作成することも、既存の作品にエピソードを追加することもできます。</p>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 4 && <div className={`w-8 h-0.5 ${s < step ? 'bg-primary/40' : 'bg-border'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {step === 1 && 'ファイル選択'}
          {step === 2 && 'プレビュー'}
          {step === 3 && '作品設定'}
          {step === 4 && '完了'}
        </span>
      </div>

      {/* Step 1: Mode + File Upload */}
      {step === 1 && (
        <div className="space-y-6">
          <Tabs
            tabs={[
              { key: 'single', label: '一括インポート（1ファイル）' },
              { key: 'multiple', label: '複数ファイルインポート（最大100件）' },
            ]}
            activeKey={mode}
            onTabChange={(key) => {
              setMode(key as ImportMode);
              setFiles([]);
              setAnalyzeResult(null);
            }}
          />

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-foreground mb-1">
              ここにファイルをドロップ、またはクリックして選択
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === 'single'
                ? '.txt ファイル（最大10MB）'
                : `.txt ファイル（最大${MAX_MULTI_FILES}件、各10MB以内）`}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.text"
            multiple={mode === 'multiple'}
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="space-y-6">
          {mode === 'single' && (
            <>
              {analyzing && (
                <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">ファイルを解析中...</span>
                </div>
              )}
              {analyzeError && (
                <div className="flex items-start gap-2 p-4 bg-destructive/10 rounded-lg text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{analyzeError}</span>
                </div>
              )}
              {analyzeResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>エンコーディング: {analyzeResult.detectedEncoding}</span>
                    <span>総文字数: {analyzeResult.totalCharacters.toLocaleString()}</span>
                    <span>検出された章: {analyzeResult.chapters.length}</span>
                  </div>
                  <div className="space-y-2">
                    {analyzeResult.chapters.map((ch, i) => (
                      <div key={i} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{ch.title || `章 ${i + 1}`}</span>
                          <span className="text-xs text-muted-foreground">{ch.content.length.toLocaleString()} 文字</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {ch.content.slice(0, 50)}...
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'multiple' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ファイルの順序がエピソードの並びになります。ドラッグまたは矢印ボタンで順序を変更できます。
              </p>
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 border border-border rounded-lg p-3">
                    <span className="text-sm text-muted-foreground w-6 text-center">{i + 1}</span>
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveFile(i, 'up')}
                        disabled={i === 0}
                        className="p-1 rounded hover:bg-secondary disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFile(i, 'down')}
                        disabled={i === files.length - 1}
                        className="p-1 rounded hover:bg-secondary disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setFiles([]);
                setAnalyzeResult(null);
                setAnalyzeError(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
            <Button
              onClick={goToStep3}
              disabled={
                (mode === 'single' && (!analyzeResult || analyzing)) ||
                (mode === 'multiple' && files.length === 0)
              }
            >
              次へ
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Work Settings */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Target mode */}
          <div className="space-y-3">
            <label className="text-sm font-medium">インポート先</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  checked={targetMode === 'new'}
                  onChange={() => setTargetMode('new')}
                  className="accent-primary"
                />
                <span className="text-sm">新規作品として作成</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  checked={targetMode === 'existing'}
                  onChange={() => setTargetMode('existing')}
                  className="accent-primary"
                />
                <span className="text-sm">既存作品に追加</span>
              </label>
            </div>
          </div>

          {targetMode === 'new' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  タイトル <span className="text-destructive">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="作品のタイトル"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">あらすじ</label>
                <textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="作品のあらすじ（任意）"
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ジャンル</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">選択してください</option>
                  {GENRES.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {targetMode === 'existing' && (
            <div>
              <label className="text-sm font-medium mb-1 block">作品を選択</label>
              {loadingWorks ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  作品一覧を読み込み中...
                </div>
              ) : myWorks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  作品がありません。「新規作品として作成」を選択してください。
                </p>
              ) : (
                <select
                  value={selectedWorkId}
                  onChange={(e) => setSelectedWorkId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">作品を選択してください</option>
                  {myWorks.map((w) => (
                    <option key={w.id} value={w.id}>{w.title}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  インポート中...
                </>
              ) : (
                'インポート実行'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && importResult && (
        <div className="text-center py-8 space-y-4">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
          <h2 className="text-lg font-bold">インポートが完了しました！</h2>
          <p className="text-sm text-muted-foreground">
            {importResult.episodeCount} エピソードがインポートされました。
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Button onClick={() => router.push(`/works/${importResult.workId}`)}>
              作品を確認する
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setFiles([]);
                setAnalyzeResult(null);
                setImportResult(null);
                setTitle('');
                setSynopsis('');
                setGenre('');
                setSelectedWorkId('');
              }}
            >
              別のファイルをインポート
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
