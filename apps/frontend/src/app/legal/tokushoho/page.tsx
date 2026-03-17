export const metadata = {
  title: '特定商取引法に基づく表記 | Workwrite',
  description: '特定商取引法に基づく表記',
};

export default function TokushohoPage() {
  return (
    <div className="px-4 md:px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold tracking-wide mb-8">特定商取引法に基づく表記</h1>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <table className="w-full border-collapse">
          <tbody className="divide-y divide-border">
            <Row label="販売業者" value="合同会社Workwrite" />
            <Row label="運営責任者" value="新留 一輝" />
            <Row
              label="所在地"
              value="〒330-0835 埼玉県さいたま市大宮区北袋町1-601-1"
            />
            <Row
              label="電話番号"
              value="050-1792-9092（平日 10:00〜18:00、土日祝日を除く）"
            />
            <Row
              label="メールアドレス"
              value={
                <div>
                  <p>info@workwrite.co.jp</p>
                  <p className="text-xs mt-1">お問い合わせ対応時間: 平日 10:00〜18:00（土日祝日を除く）</p>
                </div>
              }
            />
            <Row label="ウェブサイト" value="https://workwrite.jp" />

            <Row
              label="販売価格"
              value={
                <ul className="space-y-1">
                  <li>Standard プラン: 月額 2,980円（税込）</li>
                  <li>Pro プラン: 月額 7,980円（税込）</li>
                  <li>クレジット追加購入: 100cr = 980円（税込）</li>
                  <li>※ 各商品ページに表示された価格が適用されます。</li>
                </ul>
              }
            />

            <Row
              label="販売価格以外の必要料金"
              value="インターネット接続に必要な通信料はお客様のご負担となります。"
            />

            <Row
              label="支払方法"
              value="クレジットカード決済（Visa、Mastercard、American Express、JCB — Stripe を通じた決済）"
            />

            <Row
              label="支払時期"
              value={
                <ul className="space-y-1">
                  <li>サブスクリプション: ご登録時に初回決済、以降毎月同日に自動決済</li>
                  <li>クレジット追加購入: ご購入時に即時決済</li>
                </ul>
              }
            />

            <Row
              label="サービス提供時期"
              value="決済完了後、直ちにご利用いただけます。"
            />

            <Row
              label="申込みの有効期限"
              value={
                <ul className="space-y-1 list-disc pl-5">
                  <li>Standard プランは初回7日間の無料トライアル付きです。トライアル期間中に解約した場合、料金は発生しません。</li>
                  <li>サブスクリプションは解約手続きを行うまで毎月自動更新されます。</li>
                </ul>
              }
            />

            <Row
              label="返品・交換・キャンセルについて"
              value={
                <div className="space-y-2">
                  <p>デジタルサービスの性質上、サービス提供開始後の返品・交換はお受けしておりません。</p>
                  <ul className="space-y-1 list-disc pl-5">
                    <li>サブスクリプションはマイページからいつでも解約可能です。解約後も当該請求期間の終了日まで引き続きサービスをご利用いただけます。日割り返金は行っておりません。</li>
                    <li>追加購入したクレジットの返金はいたしかねます。</li>
                    <li>サービスに重大な不具合がある場合、または当社の責めに帰すべき事由がある場合は、個別にご対応いたします。info@workwrite.co.jp までお問い合わせください。</li>
                    <li>決済処理に関する紛争・チャージバックは Stripe の規約に準拠して対応いたします。</li>
                  </ul>
                </div>
              }
            />

            <Row
              label="動作環境"
              value={
                <div>
                  <p>Webブラウザで動作するクラウドサービスです。</p>
                  <p className="mt-1">推奨ブラウザ: 最新版の Google Chrome、Safari、Firefox、Microsoft Edge</p>
                  <p className="mt-1">推奨OS: iOS 16以降、Android 12以降、Windows 10以降、macOS 12以降</p>
                </div>
              }
            />

            <Row
              label="特別条件"
              value={
                <ul className="space-y-1 list-disc pl-5">
                  <li>サブスクリプションの料金は変更される場合があります。変更時は既存の有料会員へ30日前までに通知いたします。</li>
                  <li>クーポンや割引が適用される場合、適用条件は各プロモーションの案内に記載されます。</li>
                </ul>
              }
            />
          </tbody>
        </table>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          最終更新日: 2026年3月17日
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th className="py-3 pr-4 text-left align-top text-foreground font-medium whitespace-nowrap w-[140px]">
        {label}
      </th>
      <td className="py-3 text-muted-foreground">
        {value}
      </td>
    </tr>
  );
}
