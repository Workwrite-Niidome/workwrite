import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/** Static dictionary mapping Japanese emotion keywords to EmotionTagMaster English names */
const EMOTION_MAP: Record<string, string[]> = {
  '感動': ['tears', 'empathy'],
  '興奮': ['excitement'],
  '希望': ['hope', 'courage'],
  '切なさ': ['tears', 'nostalgia'],
  '笑い': ['laughter'],
  '恐怖': ['suspense'],
  '成長': ['growth', 'courage'],
  '癒し': ['healing'],
  '畏怖': ['awe'],
  '美しさ': ['beauty'],
  '思考': ['thinking'],
  '謎': ['mystery'],
  '勇気': ['courage'],
  '涙': ['tears'],
  '泣ける': ['tears'],
  '怖い': ['suspense'],
  '考えさせ': ['thinking'],
  '世界観': ['worldview'],
  'ワクワク': ['excitement'],
  'ドキドキ': ['excitement', 'suspense'],
  'ほっこり': ['healing'],
  '優しさ': ['healing', 'empathy'],
  '共感': ['empathy'],
  '郷愁': ['nostalgia'],
  '絶望': ['tears', 'suspense'],
  'カタルシス': ['tears', 'growth'],
  '緊張': ['suspense'],
  '驚き': ['excitement', 'awe'],
  '好奇心': ['thinking', 'mystery'],
};

@Injectable()
export class EmotionMappingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Scan emotionBlueprint fields and return matched EmotionTagMaster names.
   * No LLM cost — pure keyword matching.
   */
  mapBlueprintToTags(emotionBlueprint: any): string[] {
    if (!emotionBlueprint) return [];

    const textToScan = [
      emotionBlueprint.desiredEmotion,
      emotionBlueprint.targetEmotions,
      emotionBlueprint.coreMessage,
      emotionBlueprint.readerJourney,
    ]
      .filter(Boolean)
      .join(' ');

    if (!textToScan) return [];

    const matched = new Set<string>();
    for (const [keyword, tags] of Object.entries(EMOTION_MAP)) {
      if (textToScan.includes(keyword)) {
        for (const tag of tags) {
          matched.add(tag);
        }
      }
    }

    return Array.from(matched);
  }

  /**
   * Create WorkTag entries for author emotion tags.
   * Returns the number of tags added.
   */
  async applyAuthorEmotionTags(workId: string, authorId: string, emotionBlueprint: any): Promise<number> {
    const tagNames = this.mapBlueprintToTags(emotionBlueprint);
    if (tagNames.length === 0) return 0;

    const allTags = await this.prisma.emotionTagMaster.findMany();
    const tagMap = new Map(allTags.map((t) => [t.name, t.id]));

    let added = 0;
    for (const name of tagNames) {
      const tagId = tagMap.get(name);
      if (!tagId) continue;

      // Use upsert to avoid duplicates
      await this.prisma.userEmotionTag.upsert({
        where: { userId_workId_tagId: { userId: authorId, workId, tagId } },
        update: {},
        create: { userId: authorId, workId, tagId, intensity: 3 },
      });
      added++;
    }

    return added;
  }
}
