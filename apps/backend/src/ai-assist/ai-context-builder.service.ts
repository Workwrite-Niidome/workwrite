import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const MAX_CONTEXT_CHARS = 20000; // increased budget for richer context

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
  recentRawText: string;
  characters: CharacterContext[];
  openForeshadowings: string[];
  worldSettings: string[];
  settingEra?: string;
  sceneGoal?: SceneGoal;
  narrativePOV?: string;
  emotionalTone?: string;
  timeline?: string;
  chapterBrief?: string;
  plotOutline?: string;
  emotionGoals?: string;
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
      creationPlan,
      recentEpisodes,
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
      this.prisma.workCreationPlan.findFirst({
        where: { workId },
        select: { plotOutline: true, chapterOutline: true, emotionBlueprint: true },
      }),
      this.prisma.episode.findMany({
        where: { workId, orderIndex: { lt: currentEpisodeOrder } },
        orderBy: { orderIndex: 'desc' },
        take: 3,
        select: { content: true, orderIndex: true, title: true },
      }),
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
      summary: a.summary.slice(0, 300),
      endState: a.endState?.slice(0, 300),
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
      (w) => `[${w.category}] ${w.name}: ${w.description.slice(0, 200)}`,
    );

    // 6. Narrative POV and tone from most recent analysis
    const latestAnalysis = analyses
      .filter((a) => a.episode.orderIndex < currentEpisodeOrder)
      .pop();

    // 7. Recent raw text — last 2 episodes before current
    // recentEpisodes is ordered by orderIndex desc, so index 0 is most recent
    const recentRawText = recentEpisodes
      .slice(0, 2)
      .reverse()
      .map((ep, idx) => {
        const content = ep.content || '';
        // Most recent episode (after reverse, last item): 2000 chars; one before: 1000 chars
        const limit = idx === 0 ? 1000 : 2000;
        const tail = content.length > limit ? content.slice(-limit) : content;
        return `第${ep.orderIndex + 1}話「${ep.title}」末尾:\n${tail}`;
      })
      .join('\n\n');

    // 8. Chapter brief from creationPlan.chapterOutline
    let chapterBrief: string | undefined;
    if (creationPlan?.chapterOutline) {
      const chapterOutline = creationPlan.chapterOutline as Array<{
        title?: string;
        summary?: string;
        keyScenes?: string[];
        characters?: string[];
        emotionTarget?: string;
        emotionIntensity?: number;
      }> | null;
      if (Array.isArray(chapterOutline) && chapterOutline[currentEpisodeOrder]) {
        const ch = chapterOutline[currentEpisodeOrder];
        const lines: string[] = [];
        if (ch.title) lines.push(`タイトル: ${ch.title}`);
        if (ch.summary) lines.push(`概要: ${ch.summary}`);
        if (ch.keyScenes && ch.keyScenes.length > 0) lines.push(`主要シーン: ${ch.keyScenes.join('、')}`);
        if (ch.characters && ch.characters.length > 0) lines.push(`登場キャラクター: ${ch.characters.join('、')}`);
        if (ch.emotionTarget) {
          lines.push(`感情目標: ${ch.emotionTarget}${ch.emotionIntensity != null ? `（強度${ch.emotionIntensity}/10）` : ''}`);
        }
        if (lines.length > 0) {
          chapterBrief = lines.join('\n');
        }
      }
    }

    // 9. Plot outline from creationPlan.plotOutline
    let plotOutline: string | undefined;
    if (creationPlan?.plotOutline) {
      const po = creationPlan.plotOutline as {
        type?: string;
        actGroups?: Array<{
          label?: string;
          description?: string;
          episodes?: Array<{
            title?: string;
            whatHappens?: string;
            whyItHappens?: string;
            characters?: string[];
            emotionTarget?: string;
          }>;
        }>;
      } | string | null;
      if (typeof po === 'string') {
        plotOutline = po.slice(0, 2000);
      } else if (po && typeof po === 'object' && po.type === 'structured' && Array.isArray(po.actGroups)) {
        const lines: string[] = [];
        let total = 0;
        for (const ag of po.actGroups) {
          if (total >= 2000) break;
          const groupLines: string[] = [];
          if (ag.label) groupLines.push(`[${ag.label}]${ag.description ? ` ${ag.description}` : ''}`);
          if (Array.isArray(ag.episodes)) {
            for (const ep of ag.episodes) {
              const parts: string[] = [];
              if (ep.title) parts.push(ep.title);
              if (ep.whatHappens) parts.push(ep.whatHappens);
              if (ep.whyItHappens) parts.push(`理由: ${ep.whyItHappens}`);
              if (ep.characters && ep.characters.length > 0) parts.push(`登場: ${ep.characters.join('、')}`);
              if (ep.emotionTarget) parts.push(`感情: ${ep.emotionTarget}`);
              groupLines.push(`  - ${parts.join(' / ')}`);
            }
          }
          const groupText = groupLines.join('\n');
          lines.push(groupText);
          total += groupText.length;
        }
        if (lines.length > 0) {
          plotOutline = lines.join('\n').slice(0, 2000);
        }
      }
    }

    // 10. Emotion goals from creationPlan.emotionBlueprint
    let emotionGoals: string | undefined;
    if (creationPlan?.emotionBlueprint) {
      const eb = creationPlan.emotionBlueprint as {
        coreMessage?: string;
        targetEmotions?: string[];
        readerJourney?: string;
      } | null;
      if (eb && typeof eb === 'object') {
        const lines: string[] = [];
        if (eb.coreMessage) lines.push(`コアメッセージ: ${eb.coreMessage}`);
        if (eb.targetEmotions) {
          const emotions = Array.isArray(eb.targetEmotions) ? eb.targetEmotions.join('、') : String(eb.targetEmotions);
          if (emotions) lines.push(`感情目標: ${emotions}`);
        }
        if (eb.readerJourney) lines.push(`読者の旅路: ${eb.readerJourney}`);
        if (lines.length > 0) {
          emotionGoals = lines.join('\n');
        }
      }
    }

    return {
      currentEpisodeOrder,
      episodeSummaries,
      recentDetailedSummary,
      recentRawText,
      characters: charContexts,
      openForeshadowings: openForeshadowingList,
      worldSettings: worldSettingList,
      settingEra: work?.settingEra || undefined,
      sceneGoal: sceneData || undefined,
      narrativePOV: latestAnalysis?.narrativePOV || undefined,
      emotionalTone: latestAnalysis?.emotionalArc || undefined,
      timeline: latestAnalysis?.timelineEnd || undefined,
      chapterBrief,
      plotOutline,
      emotionGoals,
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

    // Priority 1: Grounding rules — anti-hallucination, always first
    addSection(
      `【絶対遵守ルール — ハルシネーション防止】\n` +
      `- 提供されたテキスト・構造データに記述されていない過去のイベント、会話、約束、決定を「あった」として書いてはならない\n` +
      `- 「〇〇と約束した」「〇〇を決意した」「〇〇を思い出した」等の記述は、提供テキストに明確な根拠がある場合のみ許可\n` +
      `- 原文に存在しない人物の関係性や過去の出来事を創作しないこと\n` +
      `- 不明な過去の出来事は参照せず、現在の場面に集中すること`,
    );

    // Priority 2: Chapter brief (from chapterOutline — what this episode should achieve)
    if (ctx.chapterBrief) {
      addSection(`【この話で達成すべきこと】\n${ctx.chapterBrief}`);
    }

    // Priority 3: Recent raw text (actual text from last episodes — highest priority for grounding)
    if (ctx.recentRawText) {
      addSection(`【直前エピソードの原文末尾】\n${ctx.recentRawText}`);
    }

    // Priority 4: Scene goal — what this chapter should accomplish
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

    // Priority 5: Recent detailed summary
    if (ctx.recentDetailedSummary) {
      addSection(`【直前のあらすじ】\n${ctx.recentDetailedSummary}`);
    }

    // Priority 6: World setting / era
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

    // Priority 7: Characters — split into appeared / not-yet-appeared
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

    // Priority 8: Plot outline (from creationPlan)
    if (ctx.plotOutline) {
      addSection(`【全体のプロット構成】\n${ctx.plotOutline}`);
    }

    // Priority 9: Episode summaries
    if (ctx.episodeSummaries.length > 0) {
      const summaryLines = ctx.episodeSummaries.map(
        (e) => `第${e.order + 1}話「${e.title}」: ${e.summary}`,
      );
      addSection(`【これまでの話の流れ】\n${summaryLines.join('\n')}`);
    }

    // Priority 10: Open foreshadowings
    if (ctx.openForeshadowings.length > 0) {
      addSection(`【未回収の伏線】\n${ctx.openForeshadowings.join('\n')}`);
    }

    // Priority 11: Emotion goals (from emotionBlueprint)
    if (ctx.emotionGoals) {
      addSection(`【感情設計】\n${ctx.emotionGoals}`);
    }

    // Priority 12: Narrative metadata
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
