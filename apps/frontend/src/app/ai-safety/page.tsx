import Link from 'next/link';

export default function AiSafetyPage() {
  return (
    <div className="px-4 md:px-6 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-2">AI安全性について</h1>
      <p className="text-xs text-muted-foreground mb-8">
        Workwriteが作品データをどのように保護し、AI機能の透明性をどのように確保しているかをご説明します。
      </p>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        {/* ── 作品データの保護 ── */}
        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">作品データの保護</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>
              <strong className="text-foreground">AIモデルの学習には一切使用しません。</strong>
              Workwriteが利用するAI API（Anthropic社 Claude）は、APIを通じて送信されたデータをモデルの学習・改善に使用しないことをAIプロバイダーの利用規約で明示しています。
              お客様の作品テキストは推論（リクエストの処理）にのみ使用されます。
            </li>
            <li>
              <strong className="text-foreground">分析結果はWorkwriteサーバー内にのみ保存されます。</strong>
              AI機能により生成されたスコア、分析コメント、会話履歴等は、お客様のアカウントに紐づいてWorkwriteのデータベースに保存されます。第三者と共有されることはありません。
            </li>
            <li>
              <strong className="text-foreground">AI機能は作品ごとにON/OFF可能です。</strong>
              キャラクタートーク等の機能は、作品設定画面から個別に無効化できます。無効にした機能はお客様の作品データにアクセスしません。
            </li>
          </ul>
        </section>

        {/* ── AI生成の透明性 ── */}
        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">AI生成コンテンツの透明性</h2>
          <p className="mb-3">
            Workwriteは、読者がAIの関与度を正確に把握できる仕組みを業界に先駆けて導入しています。
          </p>
          <ul className="space-y-2 list-disc pl-5">
            <li>
              <strong className="text-foreground">全AI操作の段階別記録。</strong>
              キャラクター設計、プロット構築、本文執筆アシストなど、AI機能を利用した全操作が、生成・採用・却下・編集の各アクションとともにデータベースに記録されます。
            </li>
            <li>
              <strong className="text-foreground">オリジナリティの自動算出。</strong>
              AI生成文字数と総文字数から、作品のオリジナリティ（人間の創作比率）を自動的に算出します。
              創作の補助段階（キャラクター設計・プロット等）と本文執筆では加重を分け、補助的利用が過大に評価されないよう設計しています。
            </li>
            <li>
              <strong className="text-foreground">AI利用率の表示。</strong>
              各作品にAI利用状況が表示されます:
              <ul className="list-none pl-0 mt-2 space-y-1">
                <li><span className="text-muted-foreground text-xs mr-1">✏️</span><strong className="text-foreground">オリジナル</strong> — AI利用率10%未満。ほぼ著者自身の執筆</li>
                <li><span className="text-muted-foreground text-xs mr-1">🤖</span><strong className="text-foreground">AI ○%</strong> — AI利用率10〜50%。実際の利用率を数値で表示</li>
                <li><span className="text-foreground text-xs mr-1">🤖</span><strong className="text-foreground">AI Generated</strong> — AI利用率50%超。AI主体の作品として明示</li>
              </ul>
            </li>
            <li>
              <strong className="text-foreground">AI生成率50%超で自動フラグ。</strong>
              本文のAI生成比率が50%を超える作品には「AI生成」フラグが自動的に付与され、作品ページに表示されます。この表示は投稿者が手動で変更することはできません。
            </li>
          </ul>
        </section>

        {/* ── 不正利用の防止 ── */}
        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">不正利用の防止</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>
              <strong className="text-foreground">クレジット制によるAI利用上限。</strong>
              AI機能の利用にはクレジットが必要です。月間の無料付与分を超えた利用は有料となるため、無制限のAI生成は行えません。
            </li>
            <li>
              <strong className="text-foreground">レート制限。</strong>
              AI執筆アシストは1時間あたり20回の利用制限が設けられています。不正な大量利用を防止します。
            </li>
            <li>
              <strong className="text-foreground">失敗時の自動返金。</strong>
              AI機能の呼び出しが失敗した場合、消費されたクレジットは自動的に返金されます。
            </li>
            <li>
              <strong className="text-foreground">管理者による監視。</strong>
              管理画面からAI生成フラグの確認・手動制御が可能です。
            </li>
          </ul>
        </section>

        {/* ── 盗用防止・コンテンツ保護 ── */}
        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">盗用防止とコンテンツ保護</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>
              <strong className="text-foreground">スクレイピング・自動収集の禁止。</strong>
              <Link href="/terms" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">利用規約</Link>において、
              ボット・クローラーによる作品テキストの自動収集、及びAIモデルの学習データとしての利用を明確に禁止しています。
            </li>
            <li>
              <strong className="text-foreground">AI会話履歴の完全保存。</strong>
              AI機能を通じた全メッセージ交換が記録されており、生成された内容の出所を追跡できます。
            </li>
            <li>
              <strong className="text-foreground">著作権侵害の通報対応。</strong>
              著作権侵害が疑われる作品については、通報を受け付けた上で、一時非公開→調査→最終措置の手順で対応します。
              通報先: <strong>info@workwrite.co.jp</strong>
            </li>
          </ul>
        </section>

        <p className="pt-4 border-t border-border text-xs">
          最終更新: 2026年3月25日
        </p>
      </div>
    </div>
  );
}
