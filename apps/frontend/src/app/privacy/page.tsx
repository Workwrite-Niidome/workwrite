export default function PrivacyPage() {
  return (
    <div className="px-4 md:px-6 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-8">プライバシーポリシー</h1>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">1. 収集する情報</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-foreground">アカウント情報:</strong> メールアドレス、表示名、およびご提供いただくプロフィール情報。</li>
            <li><strong className="text-foreground">読書データ:</strong> 読書の進捗状況、本棚の登録内容、ハイライト、読書時間。</li>
            <li><strong className="text-foreground">コンテンツ:</strong> 作品、エピソード、レビュー、コメント、感情タグなど、お客様が作成したもの。</li>
            <li><strong className="text-foreground">利用データ:</strong> 閲覧したページ、使用した機能、操作パターン。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">2. 情報の利用目的</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>パーソナライズされたおすすめ機能を含む、サービスの提供および改善のため。</li>
            <li>公開作品に対するAI品質スコアおよび分析の生成のため。</li>
            <li>読書タイムラインおよび自己変革の記録を構築するため。</li>
            <li>アカウントに関連するアクティビティの通知を送信するため。</li>
            <li>プラットフォームの安全性を維持し、利用規約を遵守するため。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">3. AI処理</h2>
          <p>
            公開された作品は、品質スコアおよび改善提案を生成するためにAIシステムによって分析されます。
            この分析は当社のサーバー上で実行され、結果は作品に紐づけて保存されます。
            AI分析データは第三者と共有されることはありません。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">4. データの共有</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>お客様の個人データを第三者に販売することはありません。</li>
            <li>公開プロフィール情報（表示名、自己紹介）は他のユーザーに表示されます。</li>
            <li>公開された作品およびレビューは一般に公開されます。</li>
            <li>読書アクティビティおよび感情タグは、集計・匿名化された形で表示される場合があります。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">5. データの保管とセキュリティ</h2>
          <p>
            お客様のデータは業界標準の暗号化技術を用いて安全に保管されます。
            パスワードはハッシュ化され、平文で保存されることはありません。
            お客様の情報を保護するため、セキュリティ対策を定期的に見直しています。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">6. お客様の権利</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-foreground">アクセス:</strong> プロフィールおよび設定ページからご自身のデータを確認できます。</li>
            <li><strong className="text-foreground">訂正:</strong> プロフィール情報はいつでも更新できます。</li>
            <li><strong className="text-foreground">削除:</strong> 設定からアカウントおよび関連データを削除できます。</li>
            <li><strong className="text-foreground">エクスポート:</strong> サポートへのお問い合わせにより、データのエクスポートをリクエストできます。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">7. Cookie</h2>
          <p>
            認証およびテーマ設定のために必要なCookieを使用しています。
            トラッキングCookieやサードパーティの広告Cookieは使用していません。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">8. 本ポリシーの変更</h2>
          <p>
            本プライバシーポリシーは随時更新される場合があります。
            重要な変更がある場合は、メールまたはプラットフォーム上の通知でお知らせいたします。
          </p>
        </section>

        <p className="pt-4 border-t border-border text-xs">
          最終更新: 2026年3月
        </p>
      </div>
    </div>
  );
}
