'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  BookOpen,
  PenTool,
  Sparkles,
  BarChart3,
  CreditCard,
  HelpCircle,
  Users,
  Eye,
  Globe,
  Wand2,
  FileText,
  Layers,
  Heart,
  ListOrdered,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Zap,
  Crown,
  MessageSquare,
  Mail,
  DollarSign,
  Share2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Section nav                                                       */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { id: 'intro', label: 'Workwriteとは', icon: BookOpen },
  { id: 'create', label: '作品を作る', icon: PenTool },
  { id: 'import', label: 'インポート', icon: Upload },
  { id: 'write', label: 'エピソードを書く', icon: FileText },
  { id: 'scoring', label: '品質スコアリング', icon: BarChart3 },
  { id: 'character-talk', label: 'キャラクタートーク', icon: MessageSquare },
  { id: 'grow', label: '読者を増やす', icon: Users },
  { id: 'letters', label: 'レター・収益', icon: Mail },
  { id: 'credits', label: 'クレジットと料金', icon: CreditCard },
  { id: 'faq', label: 'よくある質問', icon: HelpCircle },
] as const;

/* ------------------------------------------------------------------ */
/*  Step component                                                     */
/* ------------------------------------------------------------------ */

function Step({
  number,
  title,
  description,
  icon: Icon,
  tips,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  tips?: string[];
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {number}
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        {tips && tips.length > 0 && (
          <ul className="mt-2 space-y-1">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                       */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon: Icon,
  title,
  description,
  cost,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  cost?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">{title}</h4>
            {cost && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                {cost}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ accordion                                                      */
/* ------------------------------------------------------------------ */

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left text-sm hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span className={cn(open ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          {q}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-4',
            open && 'rotate-180',
          )}
        />
      </button>
      <div className={cn('overflow-hidden transition-all', open ? 'max-h-60 pb-4' : 'max-h-0')}>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{a}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function WritersGuidePage() {
  return (
    <div className="px-4 md:px-6 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          執筆者ガイド
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Workwriteで作品を書き始めるためのステップバイステップガイドです。
          <br className="hidden sm:block" />
          AI機能の使い方、読者を増やすコツ、クレジットの仕組みまで、すべてを解説します。
        </p>
      </div>

      {/* Section nav */}
      <nav className="flex flex-wrap gap-2 mb-10 pb-6 border-b border-border">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <s.icon className="h-3 w-3" />
            {s.label}
          </a>
        ))}
      </nav>

      <div className="space-y-16">
        {/* ============================================================ */}
        {/*  Section: Workwriteとは                                      */}
        {/* ============================================================ */}
        <section id="intro">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Workwriteとは
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Workwriteは、<strong className="text-foreground">作家の創作をAIがアシストする</strong>小説プラットフォームです。
              物語を書くのはあくまであなた自身。AIはプロットの壁打ち相手やキャラクター設計の補助、文章の推敲といった執筆の各フェーズで力を貸してくれるアシスタントです。
            </p>
            <p>
              AIの活用度は作品ごとに透明に可視化されます。AI生成テキストの割合は自動計測され、読者に対して正直に表示されます。
              だからこそ、AIを積極的に使うことも、まったく使わないことも、あなたの選択として尊重されます。
            </p>
            <p>
              書いた作品はそのまま公開でき、読者からのフィードバックやAIによる品質スコアリングで成長を実感できます。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Wand2 className="h-5 w-5 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">AIが執筆をアシスト</p>
                <p className="text-[11px] mt-1">続き・描写・校正など多彩な機能</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <BarChart3 className="h-5 w-5 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">6軸の品質スコアで成長</p>
                <p className="text-[11px] mt-1">Standard / Pro モデル選択可</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <MessageSquare className="h-5 w-5 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">キャラクタートーク</p>
                <p className="text-[11px] mt-1">登場人物と読者が会話できる</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: 作品を作る                                          */}
        {/* ============================================================ */}
        <section id="create">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            作品を作る
          </h2>

          <h3 className="text-sm font-medium mb-4 text-muted-foreground">基本的な作成フロー</h3>
          <div className="mb-8">
            <Step
              number={1}
              title="新規作品を作成"
              description="執筆ダッシュボードから「新しい作品」をクリック。タイトル、ジャンル、あらすじ（任意）を入力して作品を作成します。"
              icon={PenTool}
              tips={['タイトルは後から変更できるので、仮タイトルでも大丈夫です。']}
            />
            <Step
              number={2}
              title="登場人物を設定"
              description="作品編集画面の「キャラクター」タブから登場人物を追加します。名前、役割、性格、外見、背景などを設定できます。ここで設定したキャラクター情報は、AI執筆アシストやキャラクタートークが参照して一貫性のある体験を提供します。"
              icon={Users}
              tips={['キャラクターを詳しく設定するほど、AIアシストの精度が上がります。']}
            />
            <Step
              number={3}
              title="エピソードを作成して執筆開始"
              description="「新しいエピソード」でエピソードを追加し、エディターで本文を書き始めます。エピソードの並び順はドラッグで変更可能です。"
              icon={FileText}
            />
            <Step
              number={4}
              title="公開する"
              description="作品のステータスを「公開」に変更すると、読者に作品が公開されます。公開後は自動的にAIスコアリングが実行され、6軸の品質評価と感情タグが付与されます。"
              icon={CheckCircle2}
              tips={[
                'エピソード単位でも公開・非公開を切り替えられます。',
                '公開後も内容の編集は可能です。',
              ]}
            />
          </div>

          <h3 className="text-sm font-medium mb-4 text-muted-foreground">
            Creation Wizard（AIプロット支援）
          </h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            物語のプロットをゼロから考えるのが難しいとき、Creation Wizardが4つのステップであなたの構想を形にします。
            各ステップで1クレジットを消費します。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FeatureCard
              icon={Users}
              title="キャラクター生成"
              description="テーマやジャンルから3〜5人の登場人物を自動生成。名前・性格・動機・関係性まで設計されます。"
              cost="1cr"
            />
            <FeatureCard
              icon={Layers}
              title="プロット構築"
              description="三幕構成（序盤・展開・クライマックス）でストーリーの骨格を設計。テーマ・対立軸・転換点を提案します。"
              cost="1cr"
            />
            <FeatureCard
              icon={Heart}
              title="感情設計"
              description="読者の感情の起伏をデザイン。各シーンで狙う感情、強度（1-10）、コントラストを可視化します。"
              cost="1cr"
            />
            <FeatureCard
              icon={ListOrdered}
              title="章立て"
              description="プロット・キャラクター・感情設計を統合して、章ごとのシーン構成と目安文字数を生成します。"
              cost="1cr"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            生成結果は作品の「構想メモ」として保存され、AI執筆アシストが参照します。
            内容は自由に編集・上書きできます。
          </p>
        </section>

        {/* ============================================================ */}
        {/*  Section: インポート                                          */}
        {/* ============================================================ */}
        <section id="import">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            テキストファイルのインポート
          </h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            既にテキストファイルで作品を書いている方は、ファイルをアップロードして作品を取り込めます。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <FeatureCard
              icon={FileText}
              title="一括インポート"
              description="1つのテキストファイルから「第○章」「Chapter」等の章区切りを自動検出し、複数エピソードに分割して取り込みます。"
            />
            <FeatureCard
              icon={Layers}
              title="複数ファイルインポート"
              description="最大100件のテキストファイルをまとめてアップロード。各ファイルが1エピソードとして取り込まれます。"
            />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>対応形式: .txt（UTF-8、Shift_JIS等のエンコーディングを自動検出）、各ファイル最大10MB</p>
            <p>新規作品として作成することも、既存の作品にエピソードを追加することもできます。</p>
          </div>
          <div className="mt-4">
            <Link href="/works/import">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                インポートページへ
              </Button>
            </Link>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: エピソードを書く                                    */}
        {/* ============================================================ */}
        <section id="write">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            エピソードを書く
          </h2>

          <h3 className="text-sm font-medium mb-4 text-muted-foreground">エディターの使い方</h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            エピソードを開くと専用のエディターが表示されます。本文を入力し、右パネル（またはモバイルでは下部）からAI執筆アシストを呼び出せます。
            自動保存機能があるため、書いた内容が失われる心配はありません。
          </p>

          <h3 className="text-sm font-medium mb-4 text-muted-foreground">AI執筆アシストの機能</h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            エディター右側のAIパネルから、さまざまなアシスト機能を利用できます。
            設定したキャラクターやプロットの情報を自動的に参照し、物語の一貫性を保った提案を行います。
            AIはあくまでアシスタントとして提案を行い、最終的な採否はあなたが判断します。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <FeatureCard
              icon={ArrowRight}
              title="続きを書く"
              description="現在の文脈を読み取り、自然な続きの文章を生成します。文体やトーンも自動で合わせます。"
              cost="1cr"
            />
            <FeatureCard
              icon={PenTool}
              title="章の書き出し"
              description="章のテーマや前回のあらすじから、冒頭の文章を複数パターン提案します。"
              cost="1cr"
            />
            <FeatureCard
              icon={Users}
              title="キャラクター深掘り"
              description="登場人物の内面描写や心情を掘り下げた文章を提案します。"
              cost="1cr"
            />
            <FeatureCard
              icon={Eye}
              title="シーン描写の強化"
              description="五感を使った臨場感のある描写を追加します。風景・音・匂いなど。"
              cost="1cr"
            />
            <FeatureCard
              icon={MessageSquare}
              title="会話の改善"
              description="キャラクターの口調を活かした自然な会話文に推敲します。"
              cost="1cr"
            />
            <FeatureCard
              icon={Lightbulb}
              title="プロット展開のアイデア"
              description="現在の状況から3つの展開パターンを提案。行き詰まった時に。"
              cost="1cr"
            />
            <FeatureCard
              icon={Wand2}
              title="文体の調整"
              description="文章のトーンやリズムを指定した方向に調整します。"
              cost="1cr"
            />
            <FeatureCard
              icon={CheckCircle2}
              title="校正・推敲"
              description="誤字脱字、文法ミス、表現の不自然さを検出して修正提案します。"
              cost="0cr"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-yellow-500" />
              上位モード
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">じっくりモード（Standard以上）</strong>
                ：AIがより深く思考してから回答します。複雑なプロット展開や繊細な心情描写に最適です。
                <span className="font-mono ml-1">5cr〜/回</span>
              </p>
              <p>
                <strong className="text-foreground">高精度モード（Proのみ）</strong>
                ：最高精度のAIモデル（Opus）を使用します。文学的な表現や高度な構成の作品に。
                <span className="font-mono ml-1">30cr〜/回</span>
              </p>
            </div>
          </div>

          <h3 className="text-sm font-medium mb-3 text-muted-foreground">自由プロンプト</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            上記のテンプレート以外にも、自由にプロンプトを入力してAIに指示できます。
            「この場面を夕暮れの情景に変更して」「主人公の口調をもっと丁寧にして」など、具体的な指示を与えるほど精度の高い結果が得られます。
          </p>

          <div className="mt-6 bg-muted/50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">テキスト選択で部分アシスト</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              エディター内のテキストを選択してからAIアシストを実行すると、選択した部分だけを対象に処理します。
              全体ではなく特定の段落だけを書き直したい場合に便利です。
              生成結果は「挿入」または「置換」を選べます。
            </p>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: 品質スコアリング                                    */}
        {/* ============================================================ */}
        <section id="scoring">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            品質スコアリング
          </h2>

          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                作品を公開すると、AIが6つの観点で品質を自動評価します。スコアは作品ページに表示され、
                読者が作品を選ぶ際の参考になります。各軸の分析コメントと改善提案を参考に作品のブラッシュアップが可能です。
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: '没入力', desc: '読者を引き込む力' },
                  { label: '変容力', desc: '心に残る読後感' },
                  { label: '拡散力', desc: '人に薦めたくなる魅力' },
                  { label: '世界構築力', desc: '舞台設定の奥行き' },
                  { label: 'キャラクター深度', desc: '人物の立体感' },
                  { label: '構造スコア', desc: '物語の設計力' },
                ].map((d) => (
                  <div key={d.label} className="bg-muted/50 rounded-md p-2.5 text-center">
                    <p className="text-xs font-medium">{d.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{d.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Standard / Pro モデル選択</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                スコアリング実行時に2つのモデルから選択できます。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs font-medium">Standard</p>
                  <p className="text-[11px] text-muted-foreground mt-1">高速かつ低コスト。基本的な品質評価と改善提案を提供します。</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">文字数に応じて1cr〜</p>
                </div>
                <div className="border border-primary/40 bg-primary/5 rounded-lg p-3">
                  <p className="text-xs font-medium">Pro</p>
                  <p className="text-[11px] text-muted-foreground mt-1">より精度の高い分析と具体的な改善提案が得られます。作品の仕上げや改稿時に。</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">文字数に応じて3cr〜</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">スコアリングの出力</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">6軸のスコア</strong> — 各軸0〜100点 + レーダーチャート表示</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">各軸の分析コメント</strong> — 作品固有の場面やキャラクターを引用した具体的なフィードバック</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">改善提案3つ</strong> — インパクト順に「どこを」「どう変えると」「なぜ良くなるか」を提示</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">感情タグ</strong> — 作品の読後感情を自動検出（勇気、涙、癒し等）</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: キャラクタートーク                                  */}
        {/* ============================================================ */}
        <section id="character-talk">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            キャラクタートーク
          </h2>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              読者があなたの作品の登場人物と直接会話できる機能です。
              キャラクターは設定された性格・口調で応答し、読者の既読範囲に応じてネタバレを制御します。
            </p>
            <p>
              また、まだ作品を読んでいない読者に対しても、キャラクターが自己紹介や世界観を語ることで
              「この人の物語を読んでみたい」と思わせる作品への導線として機能します。
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium text-foreground">作者の設定</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  作品の編集ページからキャラクタートークのON/OFFを切り替えられます（デフォルト: ON）
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  OFFにすると、「キャラクターと出会う」カルーセルやキャラクタートーク開始ボタンが非表示になります
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  キャラクター設定（性格、口調、一人称等）が充実しているほど、会話の品質が向上します
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  読者がキャラクタートークに購入クレジットを使った場合、収益の一部が作者に還元されます
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: 読者を増やす                                        */}
        {/* ============================================================ */}
        <section id="grow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            読者を増やす
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">読者統計を分析する</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                作品ページには著者だけに表示される詳細な読者統計ダッシュボードがあります。以下の指標を確認できます：
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">ユニーク読者数</strong> — 作品を1話以上読んだ読者の総数</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">読了率</strong> — 読み始めた読者のうち、最終話まで到達した割合</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">エピソード別離脱率</strong> — 各話で読者がどれだけ離脱したか。どの話で引きが弱いか一目でわかります</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">新規読者チャート</strong> — 直近30日間の新規読者の推移をグラフで表示</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">感情タグとレコメンド</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                公開時にAIが自動付与する感情タグ（勇気、涙、癒し、ワクワクなど最大5つ）は、
                読者のおすすめ機能で使用されます。適切なタグがつくよう、物語の感情的要素を意識して執筆すると発見されやすくなります。
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-primary" />
                読者表示設定
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Creation Wizardで作成した世界観や感情設計のデータを、読者に公開するかどうかを作品ごとに設定できます。
                作品編集ページの「読者表示設定」セクションで以下のトグルを切り替えてください。
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">世界観タブを公開</strong>
                    ：ONにすると、作品ページに「世界観」タブが表示され、用語集・世界のルール・アイテム・歴史などを読者が閲覧できます。
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">感情設計を公開</strong>
                    ：ONにすると、「感情の旅路」として各フェーズの感情設計がグラフで可視化されます。
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                どちらもデフォルトはOFFです。ネタバレになりうる情報は公開データに含まれないよう自動的に除外されます。
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: レター・収益                                        */}
        {/* ============================================================ */}
        <section id="letters">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            レター・収益
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">ファンレターとは</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                読者がエピソードを読んだ後、感想や応援メッセージを「ファンレター」として著者に送れる機能です。
                レターには有料の投げ銭が含まれ、<strong className="text-foreground">収益の80%が著者に還元</strong>されます（プラットフォーム手数料20%）。
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">レターの種類</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'ショート', price: '¥120', chars: '140文字', color: 'bg-blue-50 dark:bg-blue-950/30' },
                  { type: 'レター', price: '¥300', chars: '500文字', color: 'bg-green-50 dark:bg-green-950/30' },
                  { type: 'プレミアム', price: '¥500', chars: '1000文字', color: 'bg-purple-50 dark:bg-purple-950/30' },
                  { type: 'ギフト', price: '¥1,000〜', chars: '1000文字', color: 'bg-amber-50 dark:bg-amber-950/30' },
                ].map((lt) => (
                  <div key={lt.type} className={`rounded-lg p-3 text-center ${lt.color}`}>
                    <p className="text-xs font-medium">{lt.type}</p>
                    <p className="text-sm font-bold mt-1">{lt.price}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{lt.chars}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ギフトレターは自由な金額を設定可能です。
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">AIモデレーション</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                すべてのレターはAIが自動審査し、誹謗中傷や不適切な内容を含むメッセージをブロックします。
                著者が安心してレターを受け取れる仕組みです。
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">収益の確認</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                ダッシュボードの「収益」ページで、累計・月間の収益とレター数を確認できます。
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Stripe Connect（著者への振込）
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  収益を銀行口座に受け取るには、収益ページからStripe Connectのアカウント設定を完了してください。
                  設定完了後、レター収益はStripe経由で自動的に振り込まれます。
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Share2 className="h-4 w-4 text-primary" />
                スコアのシェア
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                作品のAIスコアをX(Twitter)やLINEでシェアできます。
                スコア付きの美しいOGPカード画像が自動生成され、SNSで作品の魅力を伝えやすくなります。
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: クレジットと料金                                    */}
        {/* ============================================================ */}
        <section id="credits">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            クレジットと料金
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">クレジットとは</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI機能を利用する際に消費するポイントです。毎月プランに応じたクレジットが付与され、
                月内に使い切れなかった分は翌月リセットされます。追加購入したクレジットは無期限です。
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">クレジット消費一覧</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">機能</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">消費</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {[
                      { feature: 'AI執筆アシスト（通常）', cost: '1cr' },
                      { feature: 'AI執筆アシスト（じっくり）', cost: '5cr〜' },
                      { feature: 'AI執筆アシスト（高精度）', cost: '30cr〜' },
                      { feature: 'Creation Wizard（各ステップ）', cost: '1cr' },
                      { feature: 'AIスコアリング（Standard）', cost: '1cr〜' },
                      { feature: 'AIスコアリング（Pro）', cost: '3cr〜' },
                      { feature: 'キャラクタートーク', cost: '1〜2cr' },
                      { feature: '読書タイプ再診断', cost: '1cr' },
                      { feature: '校正・推敲', cost: '0cr' },
                      { feature: 'あらすじ自動生成', cost: '0cr' },
                      { feature: 'テキストファイルインポート', cost: '0cr' },
                    ].map((row) => (
                      <tr key={row.feature} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2.5">{row.feature}</td>
                        <td className="text-right px-4 py-2.5 font-mono text-xs">{row.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">プランの違い</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    name: 'Free',
                    price: '¥0',
                    credits: '初月20cr / 以降10cr',
                    icon: Sparkles,
                    features: ['簡易アシスト約3〜10回相当', 'スコアリング（Standard）', 'キャラクタートーク'],
                  },
                  {
                    name: 'Standard',
                    price: '¥2,980/月',
                    credits: '200cr/月',
                    icon: Zap,
                    features: ['通常アシスト約33〜100回相当', 'じっくりモード対応', 'スコアリング（Pro対応）', 'クレジット追加購入可', '初回7日間無料'],
                  },
                  {
                    name: 'Pro',
                    price: '¥7,980/月',
                    credits: '600cr/月',
                    icon: Crown,
                    features: ['通常アシスト約100〜300回相当', '高精度モード（Opus）', 'スコアリング（Pro対応）', 'クレジット追加購入可', '初回7日間無料'],
                  },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className={cn(
                      'border border-border rounded-lg p-4',
                      plan.name === 'Standard' && 'border-primary/40 bg-primary/5',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <plan.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{plan.name}</span>
                    </div>
                    <p className="text-lg font-bold">{plan.price}</p>
                    <p className="text-xs text-muted-foreground mb-3">{plan.credits}</p>
                    <ul className="space-y-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                詳しくは
                <Link href="/pricing" className="text-primary hover:underline ml-1">料金ページ</Link>
                をご覧ください。
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">無料で使い続けられる機能</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                作品の執筆・公開・閲覧、校正、感情タグ、レコメンド、読者統計、ハイライト、しおり、
                あらすじ自動生成、テキストファイルインポートは、すべてのプランで<strong className="text-foreground">クレジット消費なし</strong>で利用できます。
                課金なしでも十分に創作活動が行えます。
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section: よくある質問                                        */}
        {/* ============================================================ */}
        <section id="faq">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            よくある質問
          </h2>

          <div>
            <FAQ
              q="AIが生成した文章の著作権はどうなりますか？"
              a="AIが提案した文章をあなたが採用・編集した場合、最終的な作品の著作権はあなたに帰属します。Workwriteでは、AIの提案はあくまでアシストであり、最終的な創作判断は著者であるあなたが行います。"
            />
            <FAQ
              q="作品データがAIの学習に使われることはありますか？"
              a="いいえ、ありません。WorkwriteはAnthropic社のClaude APIを利用していますが、API経由で送信されたデータがAIモデルの学習（トレーニング）に使用されることはありません。詳しくは利用規約をご確認ください。"
            />
            <FAQ
              q="AIアシストでエラーが出た場合、クレジットは消費されますか？"
              a="AIの呼び出しに失敗した場合（サーバーエラー等でテキストが一切生成されなかった場合）、クレジットは自動的に返金されます。部分的にでもテキストが生成された場合は消費されます。"
            />
            <FAQ
              q="作品のオリジナリティスコアとは何ですか？"
              a="作品全体に対するAI生成テキストの割合を示す指標です。Creation Wizardの構想段階のテキストは0.3倍、執筆アシストで生成されたテキストは1.0倍で計算されます。あなた自身が書いたテキストが多いほどスコアが高くなります。"
            />
            <FAQ
              q="キャラクタートークのネタバレ制御はどうなっていますか？"
              a="キャラクターは読者の既読範囲までの内容しか知りません。まだ読んでいない展開については、キャラクター自身も「知らない」ものとして振る舞います。ただしベータ版のため、まれに精度が不十分な場合があります。"
            />
            <FAQ
              q="月間クレジットが余ったらどうなりますか？"
              a="月間付与クレジットは翌月リセット（失効）されます。繰り越しはできません。ただし、追加購入したクレジットは無期限で保持されます。消費時は月間クレジットが先に使われます。"
            />
            <FAQ
              q="途中で解約した場合、作品はどうなりますか？"
              a="有料プランを解約しても、作品やデータは一切削除されません。Freeプランに戻るだけです。公開中の作品もそのまま公開されたままになります。"
            />
            <FAQ
              q="複数の作品を同時に執筆できますか？"
              a="はい。作品数に制限はありません。ダッシュボードから複数の作品を管理でき、それぞれ独立したキャラクター・プロット設定を持てます。"
            />
            <FAQ
              q="他のサイトで公開中の作品を投稿できますか？"
              a="はい。権利者本人であれば、他サイトで公開中の作品をWorkwriteにも投稿できます（重複投稿）。テキストファイルインポート機能を使うと、まとめて取り込めます。ただし、他サイトの利用規約で重複投稿が制限されている場合はご注意ください。"
            />
          </div>
        </section>
      </div>

      {/* CTA */}
      <div className="mt-16 py-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground mb-4">
          さあ、あなたの物語を書き始めましょう。
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/dashboard">
            <Button className="gap-1.5">
              <PenTool className="h-4 w-4" />
              執筆ダッシュボードへ
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" className="gap-1.5">
              <Crown className="h-4 w-4" />
              料金プランを見る
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
