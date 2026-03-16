import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SampleExtractorService } from './sample-extractor.service';
import { StructuralProfile } from './types';

interface EpisodeInput {
  content: string;
  title: string;
  orderIndex: number;
}

@Injectable()
export class StructuralDataBuilderService {
  constructor(
    private prisma: PrismaService,
    private sampleExtractor: SampleExtractorService,
  ) {}

  async build(workId: string, episodes: EpisodeInput[]): Promise<StructuralProfile> {
    // Parallel DB queries for all structural data
    const [
      analyses,
      foreshadowings,
      worldSettings,
      dialogueSamples,
      characters,
      storyArc,
      storyScenes,
    ] = await Promise.all([
      this.prisma.episodeAnalysis.findMany({
        where: { workId },
        orderBy: { episode: { orderIndex: 'asc' } },
        include: { episode: { select: { orderIndex: true, title: true } } },
      }),
      this.prisma.foreshadowing.findMany({ where: { workId } }),
      this.prisma.worldSetting.findMany({ where: { workId, isActive: true } }),
      this.prisma.characterDialogueSample.findMany({
        where: { workId },
        orderBy: { episodeOrder: 'asc' },
      }),
      this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { name: true, role: true, personality: true, arc: true },
      }),
      this.prisma.storyArc.findUnique({
        where: { workId },
        select: { premise: true, centralConflict: true, themes: true },
      }),
      this.prisma.storyScene.findMany({
        where: { act: { arc: { workId } } },
        select: { episodeId: true, intensity: true },
      }),
    ]);

    const analysisCoverage =
      episodes.length > 0 ? analyses.length / episodes.length : 0;

    // Episode summaries
    const episodeSummaries = analyses.map((a) => ({
      order: a.episode.orderIndex,
      title: a.episode.title,
      summary: a.summary,
    }));

    // Emotional arc progression
    const emotionalArcProgression = analyses
      .map((a) => a.emotionalArc)
      .filter((arc): arc is string => !!arc);

    // POV consistency
    const povValues = analyses
      .map((a) => a.narrativePOV)
      .filter((p): p is string => !!p);
    const narrativePOV = povValues.length > 0 ? povValues[0] : null;
    const povConsistency =
      povValues.length > 0 && povValues.every((p) => p === povValues[0]);

    // Foreshadowing analysis
    const planted = foreshadowings.length;
    const resolved = foreshadowings.filter((f) => f.status === 'resolved').length;
    const unresolvedForeshadowings = foreshadowings
      .filter((f) => f.status === 'open')
      .slice(0, 10) // limit for prompt size
      .map((f) => f.description);

    // Character dialogue samples (group by character, top 3 each)
    const charDialogueMap = new Map<string, string[]>();
    for (const ds of dialogueSamples) {
      const arr = charDialogueMap.get(ds.characterName) || [];
      if (arr.length < 3) arr.push(ds.line);
      charDialogueMap.set(ds.characterName, arr);
    }
    const characterVoiceConsistency = [...charDialogueMap.entries()].map(
      ([name, samples]) => ({ name, samples }),
    );

    // World setting categories
    const categoryMap = new Map<string, number>();
    for (const ws of worldSettings) {
      categoryMap.set(ws.category, (categoryMap.get(ws.category) || 0) + 1);
    }
    const worldSettingCategories = [...categoryMap.entries()].map(
      ([category, count]) => ({ category, count }),
    );
    const worldSettingDetails = worldSettings
      .slice(0, 15) // limit
      .map((ws) => `[${ws.category}] ${ws.name}: ${ws.description}`);

    // Design data
    const hasDesignData = characters.length > 0 || !!storyArc;

    // Find climax episode using StoryScene intensity
    let climaxEpisodeOrder: number | undefined;
    if (storyScenes.length > 0) {
      const withIntensity = storyScenes.filter((s) => s.intensity && s.episodeId);
      if (withIntensity.length > 0) {
        const maxScene = withIntensity.reduce((max, s) =>
          (s.intensity || 0) > (max.intensity || 0) ? s : max,
        );
        const ep = episodes.find(
          (e) => (e as any).id === maxScene.episodeId,
        );
        if (ep) climaxEpisodeOrder = ep.orderIndex;
      }
    }

    // Text samples
    const textSamples = this.sampleExtractor.extractWithClimaxHint(
      episodes,
      climaxEpisodeOrder,
    );

    return {
      episodeSummaries,
      emotionalArcProgression,
      narrativePOV,
      povConsistency,
      totalForeshadowingsPlanted: planted,
      totalForeshadowingsResolved: resolved,
      foreshadowingResolutionRate: planted > 0 ? resolved / planted : 0,
      unresolvedForeshadowings,
      characterCount: characters.length,
      characterVoiceConsistency,
      worldSettingCategories,
      worldSettingDetails,
      hasDesignData,
      designedCharacterCount: characters.length,
      designedThemes: storyArc?.themes || [],
      designedPremise: storyArc?.premise || null,
      designedConflict: storyArc?.centralConflict || null,
      textSamples,
      analysisCoverage,
    };
  }
}
