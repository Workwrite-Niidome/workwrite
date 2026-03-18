import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Edge runtime: use public API URL (cannot reach internal services)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-db434.up.railway.app/api/v1';

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
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', fontSize: 48, fontWeight: 700 }}>
          Workwrite
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  let title = 'Workwrite';
  let author = '';
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
      author = work.author?.displayName || work.author?.name || '';
      if (work.qualityScore && work.qualityScore.overall) {
        overall = Math.round(work.qualityScore.overall);
        hasScore = true;
      }
    }
  } catch {
    // Use defaults
  }

  // If no score from work data, try scoring endpoint
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

  const displayTitle = title.length > 25 ? title.slice(0, 25) + '…' : title;
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
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: 60,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>
            Workwrite
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          {/* Left: Title + Author */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#f8fafc', lineHeight: 1.3, marginBottom: 16 }}>
              {displayTitle}
            </div>
            {author ? (
              <div style={{ fontSize: 22, color: '#94a3b8', display: 'flex' }}>
                by {author}
              </div>
            ) : null}
          </div>

          {/* Right: Score */}
          {hasScore ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 240,
                background: 'rgba(167, 139, 250, 0.1)',
                border: '2px solid rgba(167, 139, 250, 0.25)',
                borderRadius: 24,
                padding: '32px 40px',
              }}
            >
              <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600, marginBottom: 8, display: 'flex' }}>
                AI品質スコア
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: 80, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                  {overall}
                </span>
                <span style={{ fontSize: 24, color: '#64748b', marginLeft: 4 }}>/100</span>
              </div>
              {scoreLabel ? (
                <div style={{ fontSize: 22, color: scoreColor, fontWeight: 700, marginTop: 8, display: 'flex' }}>
                  {scoreLabel}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <div style={{ fontSize: 18, color: '#475569' }}>
            workwrite.jp
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
