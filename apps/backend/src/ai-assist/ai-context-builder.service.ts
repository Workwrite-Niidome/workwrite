import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const MAX_CONTEXT_CHARS = 8000; // ~16K tokens for Japanese

interface EpisodeContextItem {
  order: number;
  title: string;
  summary: string;
  endState?: string;
}

interface CharacterContext {
  name: string;
  role: string;
  personality?: string;
  speechStyle?: string;
  firstPerson?: string;
  currentState?: string;
  dialogueSamples: string[];
}

export interface AiWritingContext {
  currentEpisodeOrder: number;
  episodeSummaries: EpisodeContextItem[];
  recentDetailedSummary: string; // 直前2話の詳細要約
  characters: CharacterContext[];
  openForeshadowings: string[];
  worldSettings: string[];
  narrativePOV?: string;
  emotionalTone?: string;
  timeline?: string;
}

@Injectable()
export class AiContextBuilderService {
  private readonly logger = new Logger(AiContextBuilderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Build a token-budgeted writing context for AI assist.
   * Prioritizes: recent episodes > characters > foreshadowings > world settings
   */
  async buildContext(
    workId: string,
    currentEpisodeOrder: number,
  ): Promise<AiWritingContext> {
    // Fetch all data in parallel
    const [analyses, characters, foreshadowings, worldSettings, dialogueSamples] =
      await Promise.all([
        this.prisma.episodeAnalysis.findMany({
          where: { workId },
          orderBy: { episode: { orderIndex: 'asc' } },
          include: { episode: { select: { orderIndex: true, title: true } } },
        }),
        this.prisma.storyCharacter.findMany({
          where: { workId },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.foreshadowing.findMany({
          where: { workId, status: 'open' },
          orderBy: { plantedIn: 'asc' },
        }),
        this.prisma.worldSetting.findMany({
          where: { workId, isActive: true },
        }),
        this.prisma.characterDialogueSample.findMany({
          where: { workId },
          orderBy: { episodeOrder: 'desc' },
        }),
      ]);

    // 1. Episode summaries — all episodes as 1-line summaries
    const episodeSummaries: EpisodeContextItem[] = analyses.map((a) => ({
      order: a.episode.orderIndex,
      title: a.episode.title,
      summary: a.summary.slice(0, 150), // 1-line summary
      endState: a.endState?.slice(0, 100),
    }));

    // 2. Recent detailed summary — last 2 episodes before current
    const recentAnalyses = analyses
      .filter((a) => a.episode.orderIndex < currentEpisodeOrder)
      .slice(-2);
    const recentDetailedSummary = recentAnalyses
      .map(
        (a) =>
          `第${a.episode.orderIndex + 1}話「${a.episode.title}」:\n${a.summary}\n終了時: ${a.endState || '—'}`,
      )
      .join('\n\n');

    // 3. Character context with dialogue samples
    const charContexts: CharacterContext[] = characters.map((c) => {
      const samples = dialogueSamples
        .filter((d) => d.characterId === c.id || d.characterName === c.name)
        .slice(0, 3)
        .map((d) => `「${d.line}」(${d.emotion || d.context || ''})`);

      return {
        name: c.name,
        role: c.role,
        personality: c.personality || undefined,
        speechStyle: c.speechStyle || undefined,
        firstPerson: c.firstPerson || undefined,
        currentState: c.currentState || undefined,
        dialogueSamples: samples,
      };
    });

    // 4. Open foreshadowings
    const openForeshadowingList = foreshadowings.map(
      (f) => `[第${f.plantedIn + 1}話] ${f.description}${f.importance === 'critical' ? ' ⚠重要' : ''}`,
    );

    // 5. World settings
    const worldSettingList = worldSettings.map(
      (w) => `[${w.category}] ${w.name}: ${w.description.slice(0, 100)}`,
    );

    // 6. Narrative POV and tone from most recent analysis
    const latestAnalysis = analyses
      .filter((a) => a.episode.orderIndex < currentEpisodeOrder)
      .pop();

    return {
      currentEpisodeOrder,
      episodeSummaries,
      recentDetailedSummary,
      characters: charContexts,
      openForeshadowings: openForeshadowingList,
      worldSettings: worldSettingList,
      narrativePOV: latestAnalysis?.narrativePOV || undefined,
      emotionalTone: latestAnalysis?.emotionalArc || undefined,
      timeline: latestAnalysis?.timelineEnd || undefined,
    };
  }

  /**
   * Format context into a prompt string within token budget.
   * Returns a string ready to be injected into the AI assist prompt.
   */
  formatForPrompt(ctx: AiWritingContext): string {
    const parts: string[] = [];
    let charCount = 0;

    // Priority 1: Recent detailed summary (~1500 chars)
    if (ctx.recentDetailedSummary) {
      const section = `【直前のあらすじ】\n${ctx.recentDetailedSummary}`;
      parts.push(section);
      charCount += section.length;
    }

    // Priority 2: Characters (~2000 chars)
    if (ctx.characters.length > 0) {
      const charLines = ctx.characters.map((c) => {
        let line = `・${c.name}（${c.role}）`;
        if (c.speechStyle) line += ` 口調:${c.speechStyle}`;
        if (c.firstPerson) line += ` 一人称:${c.firstPerson}`;
        if (c.currentState) line += ` 現在:${c.currentState}`;
        if (c.dialogueSamples.length > 0) {
          line += `\n  セリフ例: ${c.dialogueSamples.join(' / ')}`;
        }
        return line;
      });
      const section = `【登場キャラクター】\n${charLines.join('\n')}`;
      if (charCount + section.length < MAX_CONTEXT_CHARS) {
        parts.push(section);
        charCount += section.length;
      }
    }

    // Priority 3: Episode summaries (~1500 chars)
    if (ctx.episodeSummaries.length > 0) {
      const summaryLines = ctx.episodeSummaries.map(
        (e) => `第${e.order + 1}話「${e.title}」: ${e.summary}`,
      );
      const section = `【これまでの話の流れ】\n${summaryLines.join('\n')}`;
      if (charCount + section.length < MAX_CONTEXT_CHARS) {
        parts.push(section);
        charCount += section.length;
      }
    }

    // Priority 4: Open foreshadowings (~500 chars)
    if (ctx.openForeshadowings.length > 0) {
      const section = `【未回収の伏線】\n${ctx.openForeshadowings.join('\n')}`;
      if (charCount + section.length < MAX_CONTEXT_CHARS) {
        parts.push(section);
        charCount += section.length;
      }
    }

    // Priority 5: World settings (~500 chars)
    if (ctx.worldSettings.length > 0) {
      const section = `【世界設定】\n${ctx.worldSettings.join('\n')}`;
      if (charCount + section.length < MAX_CONTEXT_CHARS) {
        parts.push(section);
        charCount += section.length;
      }
    }

    // Priority 6: Narrative metadata
    const meta: string[] = [];
    if (ctx.narrativePOV) meta.push(`視点: ${ctx.narrativePOV}`);
    if (ctx.emotionalTone) meta.push(`感情の流れ: ${ctx.emotionalTone}`);
    if (ctx.timeline) meta.push(`時間軸: ${ctx.timeline}`);
    if (meta.length > 0) {
      const section = `【文体情報】\n${meta.join('、')}`;
      if (charCount + section.length < MAX_CONTEXT_CHARS) {
        parts.push(section);
      }
    }

    return parts.join('\n\n');
  }
}
