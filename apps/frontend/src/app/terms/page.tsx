export default function TermsPage() {
  return (
    <div className="px-4 md:px-6 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-8">利用規約</h1>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">1. 利用規約への同意</h2>
          <p>
            Workwrite（以下「本サービス」）にアクセスまたは利用することにより、お客様は本利用規約に拘束されることに同意するものとします。
            本規約に同意いただけない場合、本サービスをご利用いただくことはできません。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">2. アカウント登録</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>アカウント作成時には、正確かつ完全な情報を提供していただく必要があります。</li>
            <li>お客様は、アカウント認証情報のセキュリティを維持する責任を負います。</li>
            <li>本サービスの利用には、13歳以上であることが必要です。</li>
            <li>一人につき複数のアカウントを保有することはできません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">3. コンテンツの所有権と投稿に関するルール</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>お客様がWorkwriteに公開したコンテンツに関するすべての権利は、お客様に帰属します。</li>
            <li>公開することにより、お客様はWorkwriteに対し、プラットフォーム上でコンテンツを表示・配信するための非独占的ライセンスを付与するものとします。</li>
            <li>オリジナルのコンテンツ、または公開権を有するコンテンツのみを投稿してください。</li>
            <li><strong>他者の作品を権利者の許諾なく本サービスに投稿・公開することは固く禁じます。</strong>これは、他の小説投稿サイトに掲載されている第三者の作品を含みます。</li>
            <li>権利者本人による投稿であること、または正当な許諾を得ていることが確認できない場合、当該コンテンツは予告なく削除される場合があります。</li>
            <li>著作権または知的財産権を侵害するコンテンツは削除され、アカウントの停止措置を行う場合があります。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">4. 禁止行為</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>他のユーザーに対する嫌がらせ、ヘイトスピーチ、または差別行為。</li>
            <li>盗用、無断転載、またはAI生成であることを開示せずにAI生成コンテンツを公開すること。</li>
            <li><strong>他者の著作物（小説、エッセイ、詩、その他の文章作品）を、権利者の明示的な許諾なく本サービスに投稿・公開すること。</strong></li>
            <li>品質スコアやエンゲージメント指標を不正に操作しようとすること。</li>
            <li>BANや制限を回避するために複数のアカウントを作成すること。</li>
            <li>マルウェア、スパム、または許可されていない広告を配信すること。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">5. AIスコアリング</h2>
          <p>
            WorkwriteはAI技術を用いて文学作品の分析およびスコアリングを行います。これらのスコアは参考として提供されるものであり、
            絶対的な品質評価を示すものではありません。アルゴリズムの更新に伴い、スコアが変更される場合があります。
            作者はスコアを非公開に設定することができます。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">6. アカウントの停止・削除</h2>
          <p>
            本規約に違反したアカウントを停止または削除する権利を留保します。
            ユーザーは設定ページからいつでもアカウントを削除することができます。
            アカウント削除後、公開された作品はプラットフォームから削除されます。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">7. 免責事項</h2>
          <p>
            Workwriteは「現状のまま」で提供され、いかなる種類の保証も行いません。
            データの損失やサービスの中断を含むがこれに限定されない、本サービスの利用または利用不能から生じる
            いかなる損害についても、当社は責任を負いません。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">8. 規約の変更</h2>
          <p>
            本規約は随時更新される場合があります。変更後も本サービスを継続して利用することにより、
            更新された規約に同意したものとみなされます。重要な変更については、メールまたはプラットフォーム上の通知にてお知らせいたします。
          </p>
        </section>

        <p className="pt-4 border-t border-border text-xs">
          最終更新: 2026年3月
        </p>
      </div>
    </div>
  );
}
