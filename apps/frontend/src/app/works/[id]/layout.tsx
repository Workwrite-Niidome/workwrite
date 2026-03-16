import type { Metadata } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { id } = params;

  let title = 'Workwrite';
  let description = '小説プラットフォーム Workwrite';

  try {
    const res = await fetch(`${API_BASE}/works/${id}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const work = data.data || data;
      title = work.title || title;
      description = work.synopsis || `${work.title} — ${work.author?.displayName || ''}の作品`;
    }
  } catch {
    // Use defaults
  }

  const ogImageUrl = `${SITE_URL}/api/og?workId=${id}`;

  return {
    title: `${title} | Workwrite`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${SITE_URL}/works/${id}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
