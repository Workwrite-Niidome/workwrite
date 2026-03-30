import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const GENRE_LABELS: Record<string, string> = {
  fantasy: 'ファンタジー', sf: 'SF', mystery: 'ミステリー', romance: '恋愛',
  horror: 'ホラー', literary: '純文学', adventure: '冒険', comedy: 'コメディ',
  drama: 'ヒューマンドラマ', historical: '歴史', modern: '現代・日常', youth: '青春', other: 'その他',
};

function getScoreLabel(score: number): string {
  if (score >= 85) return '傑作';
  if (score >= 70) return '秀作';
  if (score >= 55) return '良作';
  return '佳作';
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#a78bfa';
  if (score >= 70) return '#34d399';
  if (score >= 55) return '#60a5fa';
  return '#fbbf24';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workId = searchParams.get('workId');

  if (!workId) {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(160deg, #faf9f7 0%, #f0ede8 100%)',
          fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#1a1a1a', letterSpacing: -1 }}>
            Workwrite
          </div>
          <div style={{ fontSize: 20, color: '#6b7280', marginTop: 12 }}>
            AIが執筆パートナーになる、品質重視の創作プラットフォーム
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  let title = 'Workwrite';
  let synopsis = '';
  let author = '';
  let genre = '';
  let episodeCount = 0;
  let overall = 0;
  let hasScore = false;

  try {
    const workRes = await fetch(`${API_BASE}/works/${workId}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (workRes.ok) {
      const workData = await workRes.json();
      const work = workData.data || workData;
      title = work.title || title;
      synopsis = work.synopsis || '';
      author = work.author?.displayName || work.author?.name || '';
      genre = GENRE_LABELS[work.genre] || work.genre || '';
      episodeCount = work._count?.episodes || work.episodes?.length || 0;
      if (work.qualityScore && work.qualityScore.overall) {
        overall = Math.round(work.qualityScore.overall);
        hasScore = true;
      }
    }
  } catch {
    // Use defaults
  }

  if (!hasScore) {
    try {
      const scoreRes = await fetch(`${API_BASE}/scoring/works/${workId}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        const score = scoreData.data || scoreData;
        if (score.overall) {
          overall = Math.round(score.overall);
          hasScore = true;
        }
      }
    } catch {
      // No score available
    }
  }

  const displayTitle = title.length > 30 ? title.slice(0, 30) + '...' : title;
  const displaySynopsis = synopsis.length > 120 ? synopsis.slice(0, 120) + '...' : synopsis;
  const scoreColor = getScoreColor(overall);
  const scoreLabel = hasScore ? getScoreLabel(overall) : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #faf9f7 0%, #f0ede8 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Accent line at top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #a78bfa, #818cf8, #6366f1)',
          display: 'flex',
        }} />

        {/* Content area */}
        <div style={{ display: 'flex', flex: 1, padding: '48px 60px 32px' }}>
          {/* Left: Title + Synopsis */}
          <div style={{
            display: 'flex', flexDirection: 'column', flex: 1,
            justifyContent: 'center', paddingRight: hasScore ? 48 : 0,
          }}>
            {/* Genre badge */}
            {genre && (
              <div style={{
                display: 'flex', marginBottom: 16,
              }}>
                <span style={{
                  fontSize: 14, fontWeight: 600,
                  color: '#6366f1',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  padding: '4px 12px',
                  borderRadius: 100,
                }}>
                  {genre}
                </span>
              </div>
            )}

            {/* Title */}
            <div style={{
              fontSize: 44, fontWeight: 800, color: '#1a1a1a',
              lineHeight: 1.25, marginBottom: 16,
              letterSpacing: -0.5,
            }}>
              {displayTitle}
            </div>

            {/* Synopsis */}
            {displaySynopsis && (
              <div style={{
                fontSize: 18, color: '#4b5563', lineHeight: 1.7,
                marginBottom: 20,
              }}>
                {displaySynopsis}
              </div>
            )}

            {/* Author + meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {author && (
                <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 500 }}>
                  {author}
                </span>
              )}
              {episodeCount > 0 && (
                <span style={{ fontSize: 14, color: '#9ca3af' }}>
                  {episodeCount}話
                </span>
              )}
            </div>
          </div>

          {/* Right: Score card */}
          {hasScore && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minWidth: 200,
              background: 'white',
              borderRadius: 16,
              padding: '32px 36px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{
                fontSize: 12, color: '#9ca3af', fontWeight: 600,
                marginBottom: 8, letterSpacing: 1, display: 'flex',
              }}>
                AI品質スコア
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 72, fontWeight: 800, color: scoreColor, lineHeight: 1,
                }}>
                  {overall}
                </span>
              </div>
              {scoreLabel && (
                <div style={{
                  fontSize: 18, color: scoreColor, fontWeight: 700,
                  marginTop: 4, display: 'flex',
                }}>
                  {scoreLabel}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 60px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 4,
              background: '#1a1a1a', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#a78bfa',
            }}>
              W
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>
              Workwrite
            </span>
          </div>
          <span style={{ fontSize: 14, color: '#9ca3af' }}>
            workwrite.jp
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
