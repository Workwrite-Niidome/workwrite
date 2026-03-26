import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { isCharacterMatchSafe } from '../character-talk/character-role-filter';

@Injectable()
export class DiscoverService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async search(query: string, options?: { genre?: string; emotionTags?: string[]; limit?: number; offset?: number; sort?: string; category?: string; aiGenerated?: boolean }) {
    return this.searchService.search(query, options);
  }

  async getTopPage() {
    const [popular, recent, hiddenGems, trendingTags, highImmersion, greatWorlds] = await Promise.all([
      this.getPopularWorks(6),
      this.getRecentWorks(6),
      this.getHiddenGems(6),
      this.getTrendingEmotionTags(),
      this.getHighImmersionWorks(6),
      this.getGreatWorldBuilding(6),
    ]);
    return { popular, recent, hiddenGems, trendingTags, highImmersion, greatWorlds };
  }

  async getPopularWorks(limit = 10) {
    // Popular = most DISTINCT readers in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await this.prisma.$queryRaw<
      { workId: string; userCount: bigint }[]
    >`
      SELECT "workId", COUNT(DISTINCT "userId") AS "userCount"
      FROM "ReadingProgress"
      WHERE "updatedAt" >= ${thirtyDaysAgo}
      GROUP BY "workId"
      ORDER BY "userCount" DESC
      LIMIT ${limit * 2}
    `;

    if (recentActivity.length === 0) {
      return this.prisma.work.findMany({
        where: { status: 'PUBLISHED', qualityScore: { overall: { gte: 70 } } },
        orderBy: { totalViews: 'desc' },
        take: limit,
        include: {
          author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
          tags: true,
          qualityScore: { select: { overall: true } },
          _count: { select: { reviews: true, episodes: true } },
        },
      });
    }

    // Filter: at least 2 distinct readers
    const qualifiedActivity = recentActivity.filter((r) => Number(r.userCount) >= 2);
    const workIds = (qualifiedActivity.length > 0 ? qualifiedActivity : recentActivity).map((r) => r.workId);
    const works = await this.prisma.work.findMany({
      where: {
        id: { in: workIds },
        status: 'PUBLISHED',
        qualityScore: { overall: { gte: 70 } },
      },
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });

    const workMap = new Map(works.map((w) => [w.id, w]));
    return workIds.map((id) => workMap.get(id)).filter(Boolean).slice(0, limit) as typeof works;
  }

  async getRecentWorks(limit = 10) {
    return this.prisma.work.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getHiddenGems(limit = 6) {
    // Quality score above median but low views — "buried treasures"
    const allScores = await this.prisma.qualityScore.findMany({
      select: { overall: true },
      orderBy: { overall: 'asc' },
    });
    const median = allScores.length > 0
      ? allScores[Math.floor(allScores.length / 2)].overall
      : 50;
    const threshold = Math.max(median * 1.1, 50); // Slightly above median, floor at 50

    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        qualityScore: { overall: { gte: threshold } },
        totalViews: { lt: 300 },
      },
      orderBy: { qualityScore: { overall: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getTrendingEmotionTags() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tags = await this.prisma.userEmotionTag.groupBy({
      by: ['tagId'],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    });

    const tagDetails = await this.prisma.emotionTagMaster.findMany({
      where: { id: { in: tags.map((t) => t.tagId) } },
    });

    return tags.map((t) => {
      const detail = tagDetails.find((d) => d.id === t.tagId);
      return { ...detail, count: t._count.id };
    });
  }

  async getNextForMe(workId: string) {
    // Find emotion tags for the completed work, then find similar works
    const emotionTags = await this.prisma.userEmotionTag.findMany({
      where: { workId },
      include: { tag: true },
    });

    if (emotionTags.length === 0) {
      // Fallback: return popular works
      return this.getPopularWorks(3);
    }

    const tagIds = emotionTags.map((et) => et.tagId);

    // Find works that share emotion tags, excluding the current work
    const similarWorks = await this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: workId },
        emotionTags: { some: { tagId: { in: tagIds } } },
      },
      orderBy: { qualityScore: { overall: 'desc' } },
      take: 3,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });

    return similarWorks;
  }

  async getWorksByEmotionTag(tagName: string, limit = 20) {
    const tag = await this.prisma.emotionTagMaster.findUnique({ where: { name: tagName } });
    if (!tag) return [];

    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        emotionTags: { some: { tagId: tag.id } },
      },
      orderBy: { qualityScore: { overall: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getContinueReading(userId: string) {
    const entries = await this.prisma.bookshelfEntry.findMany({
      where: { userId, status: 'READING' },
      include: {
        work: {
          include: {
            episodes: { select: { id: true, title: true, orderIndex: true, wordCount: true }, orderBy: { orderIndex: 'asc' } },
            author: { select: { id: true, name: true, displayName: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const results = [];
    for (const entry of entries) {
      const progress = await this.prisma.readingProgress.findMany({
        where: { userId, workId: entry.workId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      });
      const latestProgress = progress[0];
      const currentEpisode = latestProgress
        ? entry.work.episodes.find(ep => ep.id === latestProgress.episodeId)
        : entry.work.episodes[0];
      results.push({
        work: entry.work,
        currentEpisode,
        progressPct: latestProgress?.progressPct ?? 0,
      });
    }
    return results;
  }

  async autocomplete(query: string) {
    if (!query || query.length < 2) return [];
    const works = await this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { author: { name: { contains: query, mode: 'insensitive' } } },
          { author: { displayName: { contains: query, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      select: {
        id: true,
        title: true,
        author: { select: { name: true, displayName: true } },
        genre: true,
      },
    });
    return works;
  }

  async getHighImmersionWorks(limit = 10) {
    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        qualityScore: { immersion: { gte: 70 } },
      },
      orderBy: { qualityScore: { immersion: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true, immersion: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getGreatWorldBuilding(limit = 10) {
    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        qualityScore: { worldBuilding: { gte: 70 } },
      },
      orderBy: { qualityScore: { worldBuilding: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true, worldBuilding: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  // ─── Character Match ─────────────────────────────────────

  // Role filtering moved to character-role-filter.ts

  /** No-op: kept for API compatibility with callers (story-structure, works services) */
  invalidateCharacterMatchCache() {
    // No-op: cache removed — DB is queried on every request
  }

  private async getAllPublicCharacters() {

    const characters = await this.prisma.storyCharacter.findMany({
      where: {
        isPublic: true,
        work: { status: 'PUBLISHED' },
      },
      select: {
        id: true,
        name: true,
        role: true,
        gender: true,
        age: true,
        personality: true,
        speechStyle: true,
        firstPerson: true,
        appearance: true,
        work: {
          select: {
            id: true,
            title: true,
            genre: true,
            synopsis: true,
            enableCharacterTalk: true,
            author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
            qualityScore: { select: { overall: true } },
          },
        },
      },
    });

    // Exclude minor roles and spoiler roles
    const safe = characters.filter((c) => isCharacterMatchSafe(c.role, c.name));

    const mapped = safe.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      gender: c.gender,
      age: c.age,
      personality: c.personality ? c.personality.slice(0, 100) : null,
      speechStyle: c.speechStyle,
      firstPerson: c.firstPerson,
      appearance: c.appearance ? c.appearance.slice(0, 80) : null,
      work: {
        id: c.work.id,
        title: c.work.title,
        genre: c.work.genre,
        synopsis: c.work.synopsis ? c.work.synopsis.slice(0, 100) : null,
        enableCharacterTalk: c.work.enableCharacterTalk,
        author: c.work.author,
        qualityScore: c.work.qualityScore,
      },
    }));

    return mapped;
  }

  async getCharacterMatches(options: {
    gender?: string;
    ageRange?: string;
    personality?: string;
    role?: string;
    genre?: string;
    page?: number;
    limit?: number;
    userId?: string;
  } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;

    let results = await this.getAllPublicCharacters();

    // Apply filters
    if (options.gender) {
      const g = options.gender.toLowerCase();
      results = results.filter((c) => c.gender?.toLowerCase().includes(g));
    }
    if (options.ageRange) {
      const ageNum = parseInt(options.ageRange, 10); // "20代" → 20
      results = results.filter((c) => {
        if (!c.age) return false;
        // Direct match: "20代", "20代後半" etc.
        if (c.age.includes(options.ageRange!)) return true;
        // Numeric match: "17歳" → 10代, "25歳" → 20代
        const match = c.age.match(/(\d+)歳/);
        if (match && !isNaN(ageNum)) {
          const decade = Math.floor(parseInt(match[1], 10) / 10) * 10;
          return decade === ageNum;
        }
        return false;
      });
    }
    if (options.genre) {
      results = results.filter((c) => c.work.genre === options.genre);
    }
    if (options.personality) {
      const p = options.personality.toLowerCase();
      results = results.filter((c) => c.personality?.toLowerCase().includes(p));
    }

    // Exclude works the user already completed (but keep own works)
    if (options.userId) {
      const [readWorks, ownWorks] = await Promise.all([
        this.prisma.bookshelfEntry.findMany({
          where: { userId: options.userId, status: 'COMPLETED' },
          select: { workId: true },
        }),
        this.prisma.work.findMany({
          where: { authorId: options.userId },
          select: { id: true },
        }),
      ]);
      const ownWorkIds = new Set(ownWorks.map((w) => w.id));
      const readIds = new Set(readWorks.map((r) => r.workId));
      if (readIds.size > 0) {
        results = results.filter((c) => ownWorkIds.has(c.work.id) || !readIds.has(c.work.id));
      }

      // Boost preferred genres to top
      const emotionTags = await this.prisma.userEmotionTag.findMany({
        where: { userId: options.userId },
        select: { work: { select: { genre: true } } },
        take: 50,
      });
      const preferredGenres = new Set(
        emotionTags.map((t) => t.work.genre).filter(Boolean),
      );
      if (preferredGenres.size > 0) {
        results.sort((a, b) => {
          const aMatch = preferredGenres.has(a.work.genre) ? 1 : 0;
          const bMatch = preferredGenres.has(b.work.genre) ? 1 : 0;
          return bMatch - aMatch;
        });
      }
    }

    const total = results.length;
    const start = (page - 1) * limit;
    const data = results.slice(start, start + limit);

    return { data, total, page, limit };
  }

  async getWorksByGenre(genre: string, limit = 20, cursor?: string) {
    return this.prisma.work.findMany({
      where: { status: 'PUBLISHED', genre },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }
}
