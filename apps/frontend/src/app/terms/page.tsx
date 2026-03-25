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
            <li>公開することにより、お客様はWorkwriteに対し、プラットフォーム上でコンテンツを表示・配信するための非独占的ライセンスを付与するものとします。このライセンスは、お客様がコンテンツを削除した時点で終了します。</li>
            <li>オリジナルのコンテンツ、または公開権を有するコンテンツのみを投稿してください。</li>
            <li><strong>他者の作品を権利者の許諾なく本サービスに投稿・公開することは固く禁じます。</strong>これは、他の小説投稿サイトに掲載されている第三者の作品を含みます。</li>
            <li>権利者本人による投稿であること、または正当な許諾を得ていることが確認できない場合、当該コンテンツは予告なく削除される場合があります。</li>
            <li>著作権または知的財産権を侵害するコンテンツは削除され、アカウントの停止措置を行う場合があります。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">4. 他サービスとの重複投稿</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>お客様は、他の小説投稿サービスで公開中の作品を本サービスにも投稿することができます（重複投稿）。</li>
            <li>重複投稿を行う場合、お客様は当該作品の権利を有していること、または権利者の許諾を得ていることを保証するものとします。</li>
            <li>他サービスの利用規約により重複投稿が制限されている場合、お客様はその規約を遵守する責任を負います。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">5. 禁止行為</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>他のユーザーに対する嫌がらせ、ヘイトスピーチ、または差別行為。</li>
            <li>盗用、無断転載、またはAI生成であることを開示せずにAI生成コンテンツを公開すること（第7条を参照）。</li>
            <li><strong>他者の著作物（小説、エッセイ、詩、その他の文章作品）を、権利者の明示的な許諾なく本サービスに投稿・公開すること。</strong></li>
            <li>品質スコアやエンゲージメント指標を不正に操作しようとすること。</li>
            <li>BANや制限を回避するために複数のアカウントを作成すること。</li>
            <li>マルウェア、スパム、または許可されていない広告を配信すること。</li>
            <li>本サービスのコンテンツ（作品テキスト、レビュー、ユーザー情報等）を、スクレイピング、クローリング、ボット等の自動化された手段を用いて収集・複製・蓄積すること（第6条を参照）。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">6. 自動収集・スクレイピングの禁止</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>本サービスのコンテンツを、手動での閲覧以外の方法で収集・複製・蓄積する行為を禁止します。これにはスクレイピング、クローリング、ボットによる自動アクセス、APIの非公開エンドポイントへのアクセスを含みますが、これらに限りません。</li>
            <li><strong>本サービスのデータ（作品テキストを含む）をAIモデルの学習データとして収集・利用する行為を禁止します。</strong></li>
            <li>検索エンジンのクローラーは、robots.txtの指定に従う範囲で許可します。</li>
            <li>違反が確認された場合、IPアドレスのブロック及び法的措置を含む対応を行う場合があります。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">7. AI生成コンテンツの取り扱い</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>Workwriteでは、AIを活用した創作を支持します。ただし、読者への透明性を確保するため、以下のルールを設けます。</li>
            <li><strong>本サービスのAI機能を利用した場合:</strong> AI利用率は自動的に計測され、オリジナリティ指標として作品ページに表示されます。この表示は投稿者が手動で変更することはできません。</li>
            <li><strong>本サービス外のAIツールを使用して本文を生成した場合:</strong> 投稿者は、作品設定画面でAI利用ありを選択する義務があります。</li>
            <li>本文の概ね50%以上がAI生成の場合、当該作品は「AI生成作品」として自動的にフラグが付与されます。</li>
            <li>プロット検討・校正・表現の相談など、補助的なAI利用については開示不要です。</li>
            <li><strong>AI生成の未開示が判明した場合:</strong> 初回は警告及びAIフラグの強制付与、繰り返しの場合は作品の非公開措置またはアカウント停止の対象となります。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">8. AIスコアリング</h2>
          <p>
            WorkwriteはAI技術を用いて文学作品の分析およびスコアリングを行います。これらのスコアは参考として提供されるものであり、
            絶対的な品質評価を示すものではありません。アルゴリズムの更新に伴い、スコアが変更される場合があります。
            作者はスコアを非公開に設定することができます。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">9. AI機能における作品データの取り扱い</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>本サービスでは、品質スコアリング、AI執筆アシスト、キャラクタートーク等の機能において、外部のAI APIサービス（Anthropic社 Claude API）を利用しています。</li>
            <li><strong>お客様の作品データがAIモデルの学習（トレーニング）に使用されることはありません。</strong>API経由で送信されたデータは、リクエストの処理（推論）にのみ使用され、モデルの改善や再学習には一切利用されません。これはAI APIプロバイダーの利用規約においても明示されています。</li>
            <li>AI機能の利用により生成された分析結果、スコア、会話内容等は、お客様のアカウントに紐づいて本サービス内にのみ保存されます。第三者と共有されることはありません。</li>
            <li>作者は、作品設定から各AI機能（キャラクタートーク等）のON/OFFを個別に制御できます。</li>
            <li>AI機能の利用にあたっての詳細は、<a href="/ai-safety" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">AI安全性について</a>のページをご確認ください。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">10. 著作権侵害への対応</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>本サービスに投稿された作品が第三者の著作権を侵害しているとの通報を受けた場合、当社は以下の手順で対応します。
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>通報内容の確認</li>
                <li>該当作品の一時非公開</li>
                <li>投稿者への通知及び弁明の機会の付与</li>
                <li>調査結果に基づく最終措置（削除・復元・アカウント停止）</li>
              </ol>
            </li>
            <li>著作権侵害の通報は <strong>info@workwrite.co.jp</strong> 宛にお送りください。通報には、権利者の氏名・連絡先、侵害されている原著作物の特定情報、当サービス上の該当作品のURL、侵害の具体的な説明を含めてください。</li>
            <li>虚偽の通報を行った場合、通報者が法的責任を負う場合があります。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">11. アカウントの停止・削除</h2>
          <p>
            本規約に違反したアカウントを停止または削除する権利を留保します。
            ユーザーは設定ページからいつでもアカウントを削除することができます。
            アカウント削除後、公開された作品はプラットフォームから削除されます。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">12. 免責事項</h2>
          <p>
            Workwriteは「現状のまま」で提供され、いかなる種類の保証も行いません。
            データの損失やサービスの中断を含むがこれに限定されない、本サービスの利用または利用不能から生じる
            いかなる損害についても、当社は責任を負いません。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">13. 準拠法・管轄裁判所</h2>
          <p>
            本規約は日本法に準拠し、日本法に従って解釈されるものとします。
            本規約に関する紛争については、さいたま地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] text-foreground mb-3">14. 規約の変更</h2>
          <p>
            本規約は随時更新される場合があります。変更後も本サービスを継続して利用することにより、
            更新された規約に同意したものとみなされます。重要な変更については、メールまたはプラットフォーム上の通知にてお知らせいたします。
          </p>
        </section>

        <p className="pt-4 border-t border-border text-xs">
          最終更新: 2026年3月25日
        </p>
      </div>
    </div>
  );
}
