import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function getScoreLabel(score: number): string {
  if (score >= 80) return '秀作';
  if (score >= 60) return '良作';
  if (score >= 40) return '佳作';
  return '—';
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#2563eb';
  if (score >= 40) return '#d97706';
  return '#6b7280';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workId = searchParams.get('workId');

  if (!workId) {
    return new Response('Missing workId', { status: 400 });
  }

  // Fetch work data from backend
  let title = 'Workwrite';
  let author = '';
  let overall = 0;
  let immersion = 0;
  let transformation = 0;
  let virality = 0;
  let worldBuilding = 0;

  try {
    const [workRes, scoreRes] = await Promise.all([
      fetch(`${API_BASE}/works/${workId}`),
      fetch(`${API_BASE}/scoring/works/${workId}`),
    ]);
    if (workRes.ok) {
      const workData = await workRes.json();
      const work = workData.data || workData;
      title = work.title || title;
      author = work.author?.displayName || work.author?.name || '';
    }
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      const score = scoreData.data || scoreData;
      overall = Math.round(score.overall || 0);
      immersion = Math.round(score.immersion || 0);
      transformation = Math.round(score.transformation || 0);
      virality = Math.round(score.virality || 0);
      worldBuilding = Math.round(score.worldBuilding || 0);
    }
  } catch {
    // Use defaults
  }

  const scoreColor = getScoreColor(overall);
  const scoreLabel = getScoreLabel(overall);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#94a3b8' }}>
            Workwrite AI品質分析
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, gap: '60px' }}>
          {/* Left: Title + Author */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#f8fafc', lineHeight: 1.3, marginBottom: '16px' }}>
              {title.length > 30 ? title.slice(0, 30) + '...' : title}
            </div>
            {author && (
              <div style={{ fontSize: '22px', color: '#94a3b8' }}>
                by {author}
              </div>
            )}
          </div>

          {/* Right: Score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '280px' }}>
            <div style={{ fontSize: '96px', fontWeight: 'bold', color: scoreColor, lineHeight: 1 }}>
              {overall}
            </div>
            <div style={{ fontSize: '28px', color: scoreColor, marginTop: '8px', fontWeight: '600' }}>
              {scoreLabel}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: '没入力', value: immersion },
                { label: '変容力', value: transformation },
                { label: '拡散力', value: virality },
                { label: '世界構築', value: worldBuilding },
              ].map((axis) => (
                <div key={axis.label} style={{ textAlign: 'center' as const, minWidth: '60px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>{axis.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e2e8f0' }}>{axis.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <div style={{ fontSize: '18px', color: '#475569' }}>
            workwrite.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    },
  );
}
