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
            <Row label="所在地" value="請求があった場合には遅滞なく開示いたします。" />
            <Row label="電話番号" value="請求があった場合には遅滞なく開示いたします。" />
            <Row label="メールアドレス" value="info@workwrite.co.jp" />
            <Row label="ウェブサイト" value="https://workwrite.jp" />

            <Row
              label="販売価格"
              value={
                <ul className="space-y-1">
                  <li>Standard プラン: 月額 2,980円（税込）</li>
                  <li>Pro プラン: 月額 7,980円（税込）</li>
                  <li>クレジット追加購入: 100cr = 980円（税込）</li>
                </ul>
              }
            />

            <Row
              label="販売価格以外の必要料金"
              value="インターネット接続に必要な通信料はお客様のご負担となります。"
            />

            <Row
              label="支払方法"
              value="クレジットカード決済（Stripe を通じた決済）"
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
              label="返品・キャンセルについて"
              value={
                <div className="space-y-2">
                  <p>デジタルコンテンツの性質上、サービス提供開始後の返金は原則として行いません。</p>
                  <ul className="space-y-1 list-disc pl-5">
                    <li>サブスクリプションはいつでも解約可能です。解約後も当該請求期間の終了時まで引き続きご利用いただけます。</li>
                    <li>追加購入したクレジットの返金はいたしかねます。</li>
                    <li>決済処理に関する紛争・返金は Stripe の規約に準拠して対応いたします。</li>
                  </ul>
                </div>
              }
            />

            <Row
              label="動作環境"
              value="最新版の Google Chrome、Safari、Firefox、Microsoft Edge を推奨しています。"
            />

            <Row
              label="特別条件"
              value={
                <ul className="space-y-1 list-disc pl-5">
                  <li>Standard プランは初回7日間の無料トライアルをご利用いただけます。トライアル期間中に解約すれば料金は発生しません。</li>
                  <li>サブスクリプションの料金は予告なく変更される場合があります。変更時は既存の有料会員へ事前に通知いたします。</li>
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
