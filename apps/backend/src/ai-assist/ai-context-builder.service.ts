import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const MAX_CONTEXT_CHARS = 10000; // increased budget for richer context

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
  relationships: string[]; // e.g. "アカネ→幼馴染", "リン→師匠"
  hasAppeared: boolean; // whether this character has appeared before current episode
}

interface SceneGoal {
  actTitle: string;
  actNumber: number;
  sceneTitle: string;
  sceneSummary?: string;
  emotionTarget?: string;
  intensity?: number;
  turningPoint?: string;
}

export interface AiWritingContext {
  currentEpisodeOrder: number;
  episodeSummaries: EpisodeContextItem[];
  recentDetailedSummary: string;
  characters: CharacterContext[];
  openForeshadowings: string[];
  worldSettings: string[];
  settingEra?: string;
  sceneGoal?: SceneGoal;
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
   */
  async buildContext(
    workId: string,
    currentEpisodeOrder: number,
  ): Promise<AiWritingContext> {
    // Fetch all data in parallel
    const [
      work,
      analyses,
      characters,
      charRelations,
      foreshadowings,
      worldSettings,
      dialogueSamples,
      sceneData,
    ] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        select: { genre: true, settingEra: true },
      }),
      this.prisma.episodeAnalysis.findMany({
        where: { workId },
        orderBy: { episode: { orderIndex: 'asc' } },
        include: { episode: { select: { orderIndex: true, title: true, id: true } } },
      }),
      this.prisma.storyCharacter.findMany({
        where: { workId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.storyCharacterRelation.findMany({
        where: {
          from: { workId },
        },
        include: {
          from: { select: { name: true } },
          to: { select: { name: true } },
        },
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
      this.getSceneGoalForEpisode(workId, currentEpisodeOrder),
    ]);

    // Build set of character names that have appeared before current episode
    const appearedCharNames = new Set<string>();
    for (const a of analyses) {
      if (a.episode.orderIndex >= currentEpisodeOrder) continue;
      const chars = a.characters as Array<{ name: string }> | null;
      if (chars) {
        for (const c of chars) {
          appearedCharNames.add(c.name);
        }
      }
    }

    // Build relationship map: characterId -> relationships[]
    const relationMap = new Map<string, string[]>();
    for (const rel of charRelations) {
      const fromId = rel.fromCharacterId;
      const entry = `${rel.to.name}→${rel.relationType}${rel.description ? `(${rel.description})` : ''}`;
      if (!relationMap.has(fromId)) relationMap.set(fromId, []);
      relationMap.get(fromId)!.push(entry);

      // Reverse direction too
      const toId = rel.toCharacterId;
      const reverseEntry = `${rel.from.name}→${rel.relationType}${rel.description ? `(${rel.description})` : ''}`;
      if (!relationMap.has(toId)) relationMap.set(toId, []);
      relationMap.get(toId)!.push(reverseEntry);
    }

    // 1. Episode summaries
    const episodeSummaries: EpisodeContextItem[] = analyses.map((a) => ({
      order: a.episode.orderIndex,
      title: a.episode.title,
      summary: a.summary.slice(0, 150),
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

    // 3. Character context with relationships and appearance status
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
        relationships: relationMap.get(c.id) || [],
        hasAppeared: appearedCharNames.has(c.name),
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
      settingEra: work?.settingEra || undefined,
      sceneGoal: sceneData || undefined,
      narrativePOV: latestAnalysis?.narrativePOV || undefined,
      emotionalTone: latestAnalysis?.emotionalArc || undefined,
      timeline: latestAnalysis?.timelineEnd || undefined,
    };
  }

  /**
   * Find the StoryScene linked to the current episode for chapter goal context.
   */
  private async getSceneGoalForEpisode(
    workId: string,
    episodeOrder: number,
  ): Promise<SceneGoal | null> {
    // Find episode by orderIndex
    const episode = await this.prisma.episode.findFirst({
      where: { workId, orderIndex: episodeOrder },
      select: { id: true },
    });
    if (!episode) return null;

    const scene = await this.prisma.storyScene.findFirst({
      where: { episodeId: episode.id },
      include: {
        act: {
          select: { title: true, actNumber: true, turningPoint: true },
        },
      },
    });
    if (!scene) return null;

    return {
      actTitle: scene.act.title,
      actNumber: scene.act.actNumber,
      sceneTitle: scene.title,
      sceneSummary: scene.summary || undefined,
      emotionTarget: scene.emotionTarget || undefined,
      intensity: scene.intensity || undefined,
      turningPoint: scene.act.turningPoint || undefined,
    };
  }

  /**
   * Format context into a prompt string within token budget.
   */
  formatForPrompt(ctx: AiWritingContext): string {
    const parts: string[] = [];
    let charCount = 0;

    const addSection = (section: string): boolean => {
      if (charCount + section.length < MAX_CONTEXT_CHARS) {
        parts.push(section);
        charCount += section.length;
        return true;
      }
      return false;
    };

    // Priority 1: Scene goal — what this chapter should accomplish
    if (ctx.sceneGoal) {
      const g = ctx.sceneGoal;
      const lines = [`第${g.actNumber}幕「${g.actTitle}」— ${g.sceneTitle}`];
      if (g.sceneSummary) lines.push(`目的: ${g.sceneSummary}`);
      if (g.emotionTarget) {
        lines.push(`感情目標: ${g.emotionTarget}${g.intensity ? `（強度${g.intensity}/10）` : ''}`);
      }
      if (g.turningPoint) lines.push(`幕の転換点: ${g.turningPoint}`);
      addSection(`【この章の目的】\n${lines.join('\n')}`);
    }

    // Priority 2: Recent detailed summary (~1500 chars)
    if (ctx.recentDetailedSummary) {
      addSection(`【直前のあらすじ】\n${ctx.recentDetailedSummary}`);
    }

    // Priority 3: World setting / era (~500 chars)
    {
      const worldLines: string[] = [];
      if (ctx.settingEra) {
        worldLines.push(`時代・世界観: ${ctx.settingEra}`);
        worldLines.push('※この世界観に存在しない現代語・現代技術・現代の概念は使用禁止');
      }
      if (ctx.worldSettings.length > 0) {
        worldLines.push(...ctx.worldSettings);
      }
      if (worldLines.length > 0) {
        addSection(`【世界設定】\n${worldLines.join('\n')}`);
      }
    }

    // Priority 4: Characters — split into appeared / not-yet-appeared
    if (ctx.characters.length > 0) {
      const appeared = ctx.characters.filter((c) => c.hasAppeared);
      const notAppeared = ctx.characters.filter((c) => !c.hasAppeared);

      const formatChar = (c: CharacterContext): string => {
        let line = `・${c.name}（${c.role}）`;
        if (c.speechStyle) line += ` 口調:${c.speechStyle}`;
        if (c.firstPerson) line += ` 一人称:${c.firstPerson}`;
        if (c.currentState) line += ` 現在:${c.currentState}`;
        if (c.relationships.length > 0) {
          line += `\n  関係性: ${c.relationships.join('、')}`;
        }
        if (c.dialogueSamples.length > 0) {
          line += `\n  セリフ例: ${c.dialogueSamples.join(' / ')}`;
        }
        return line;
      };

      const charSections: string[] = [];

      if (appeared.length > 0) {
        charSections.push(
          `【読者に紹介済みのキャラクター】\n` +
          appeared.map(formatChar).join('\n') +
          `\n※関係性が近いキャラクター同士（幼馴染・家族・親友等）の会話では、口調設定に縛られず関係性に応じた自然な話し方にしてください`,
        );
      }

      if (notAppeared.length > 0) {
        charSections.push(
          `【まだ物語に登場していないキャラクター】\n` +
          notAppeared.map(formatChar).join('\n') +
          `\n※これらのキャラクターが初めて登場する場合、読者にとって未知の人物です。外見・印象・雰囲気など、読者目線での導入描写を必ず行ってください。「名前」だけで登場させず、誰なのかが自然に伝わる描写を入れてください`,
        );
      }

      const section = charSections.join('\n\n');
      addSection(section);
    }

    // Priority 5: Episode summaries (~1500 chars)
    if (ctx.episodeSummaries.length > 0) {
      const summaryLines = ctx.episodeSummaries.map(
        (e) => `第${e.order + 1}話「${e.title}」: ${e.summary}`,
      );
      addSection(`【これまでの話の流れ】\n${summaryLines.join('\n')}`);
    }

    // Priority 6: Open foreshadowings (~500 chars)
    if (ctx.openForeshadowings.length > 0) {
      addSection(`【未回収の伏線】\n${ctx.openForeshadowings.join('\n')}`);
    }

    // Priority 7: Narrative metadata
    const meta: string[] = [];
    if (ctx.narrativePOV) meta.push(`視点: ${ctx.narrativePOV}`);
    if (ctx.emotionalTone) meta.push(`感情の流れ: ${ctx.emotionalTone}`);
    if (ctx.timeline) meta.push(`時間軸: ${ctx.timeline}`);
    if (meta.length > 0) {
      addSection(`【文体情報】\n${meta.join('、')}`);
    }

    return parts.join('\n\n');
  }
}
