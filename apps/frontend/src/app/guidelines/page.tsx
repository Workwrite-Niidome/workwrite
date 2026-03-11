export default function GuidelinesPage() {
  return (
    <div className="px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">投稿ガイドライン</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">「いい作品」とは</h2>
        <p className="text-muted-foreground leading-relaxed">
          Workwriteにおける「いい作品」とは、読者の心に変化をもたらす作品です。
          PV数や人気ランキングだけでなく、AIスコアリングと読者の感情タグによって、
          作品の本質的な価値を評価します。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">品質評価の4軸</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li><strong className="text-foreground">没入力</strong> - 読者がどれだけ作品世界に引き込まれるか</li>
          <li><strong className="text-foreground">変容力</strong> - 読後に読者の価値観や感情にどんな変化をもたらすか</li>
          <li><strong className="text-foreground">拡散力</strong> - 他の読者にも薦めたくなるか</li>
          <li><strong className="text-foreground">世界構築力</strong> - 作品世界の構築がどれだけ精緻か</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">投稿規約</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li>オリジナル作品のみ投稿可能です</li>
          <li>著作権を侵害する作品は掲載できません</li>
          <li>暴力的・差別的な表現は適切なタグ付けをお願いします</li>
          <li>作品は日本語で記述してください</li>
          <li>1エピソードあたり500文字以上を推奨します</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">AIスコアリングについて</h2>
        <p className="text-muted-foreground leading-relaxed">
          エピソード投稿後、AIが自動的に品質を分析しスコアを算出します。
          スコアは作家ダッシュボードで確認でき、改善ポイントも合わせて提示されます。
          スコアは非公開にすることも可能です。
        </p>
      </section>
    </div>
  );
}
