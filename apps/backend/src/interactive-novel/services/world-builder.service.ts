import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { EventSplitterService } from './event-splitter.service';

const HAIKU = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

interface ExtractedLocation {
  name: string;
  description: string;
  type: 'interior' | 'exterior' | 'abstract';
  episodeIndices: number[];
}

@Injectable()
export class WorldBuilderService {
  private readonly logger = new Logger(WorldBuilderService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private eventSplitter: EventSplitterService,
  ) {}

  async getWorldStatus(workId: string) {
    const [locations, events, schedules] = await Promise.all([
      this.prisma.worldLocation.count({ where: { workId } }),
      this.prisma.storyEvent.count({ where: { workId } }),
      this.prisma.characterSchedule.count({ where: { workId } }),
    ]);

    // Retrieve stored intro text
    let introText: string[] | null = null;
    const introRendering = await this.prisma.locationRendering.findFirst({
      where: { location: { workId }, timeOfDay: 'intro' },
    });
    if (introRendering) {
      const data = introRendering.sensoryText as any;
      introText = data?.paragraphs || null;
    }

    return { locations, events, schedules, introText };
  }

  /**
   * Build world for any completed work. Fully automatic.
   * 1. Validate work is COMPLETED
   * 2. Extract locations from EpisodeAnalysis or episode text
   * 3. Create LocationConnections from co-occurrence
   * 4. Generate basic LocationRenderings
   * 5. Build CharacterSchedules
   * 6. Split episodes into StoryEvents
   */
  async buildWorld(workId: string): Promise<{
    locations: number; connections: number; renderings: number;
    schedules: number; events: number;
  }> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { id: true, title: true, completionStatus: true, genre: true, settingEra: true },
    });
    if (!work) throw new BadRequestException('Work not found');
    if (!['COMPLETED', 'ONGOING'].includes(work.completionStatus || '')) {
      throw new BadRequestException('Interactive Novel is only available for completed or ongoing works');
    }

    this.logger.log(`Building world for "${work.title}" (${workId})`);

    // Mark as building
    await this.prisma.work.update({
      where: { id: workId },
      data: { enableInteractiveNovel: true, interactiveNovelStatus: 'building' },
    });

    try {
      // Step 1: Get episodes and analyses
      const episodes = await this.prisma.episode.findMany({
        where: { workId, publishedAt: { not: null } },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, orderIndex: true, content: true },
      });

      const analyses = await this.prisma.episodeAnalysis.findMany({
        where: { workId },
        include: { episode: { select: { orderIndex: true } } },
      });

      const characters = await this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { id: true, name: true, role: true, personality: true },
      });

      // Step 2: Extract locations
      const extractedLocations = this.extractLocations(episodes, analyses);
      this.logger.log(`Extracted ${extractedLocations.length} locations`);

      // Clear existing data
      await this.prisma.storyEvent.deleteMany({ where: { workId } });
      await this.prisma.characterSchedule.deleteMany({ where: { workId } });
      // LocationRenderings are cascade-deleted when WorldLocations are deleted below
      await this.prisma.locationConnection.deleteMany({ where: { workId } });
      await this.prisma.worldLocation.deleteMany({ where: { workId } });

      // Create WorldLocations
      const locationMap = new Map<string, string>(); // name -> id
      for (const loc of extractedLocations) {
        const created = await this.prisma.worldLocation.create({
          data: {
            workId,
            name: loc.name,
            type: loc.type,
            description: loc.description,
            generationStatus: 'complete',
            derivedFrom: loc.episodeIndices.map(i => ({ orderIndex: i })),
          },
        });
        locationMap.set(loc.name, created.id);
      }

      // Step 3: Create connections (locations that appear in adjacent scenes)
      const connections = this.inferConnections(extractedLocations);
      let connCount = 0;
      for (const conn of connections) {
        const fromId = locationMap.get(conn.from);
        const toId = locationMap.get(conn.to);
        if (fromId && toId) {
          await this.prisma.locationConnection.create({
            data: { workId, fromLocationId: fromId, toLocationId: toId, description: conn.to },
          });
          connCount++;
        }
      }

      // Step 4: Generate AI-powered LocationRenderings
      const workContext = {
        genre: work.genre || undefined,
        settingEra: work.settingEra || undefined,
      };
      const analysisContext = analyses.map(a => ({
        episodeIndex: a.episode?.orderIndex ?? 0,
        tone: (a as any).tone || undefined,
        summary: (a as any).summary || undefined,
        locations: (a.locations as any[]) || [],
      }));

      let renderCount = 0;
      for (const loc of extractedLocations) {
        const locId = locationMap.get(loc.name);
        if (!locId) continue;

        const renderings = await this.generateAiRenderings(loc, episodes, workContext, analysisContext);
        for (const r of renderings) {
          await this.prisma.locationRendering.upsert({
            where: { locationId_timeOfDay: { locationId: locId, timeOfDay: r.timeOfDay } },
            create: { locationId: locId, timeOfDay: r.timeOfDay, sensoryText: r.sensoryText },
            update: { sensoryText: r.sensoryText },
          });
          renderCount++;
        }
      }

      // Step 5: Build CharacterSchedules
      let scheduleCount = 0;
      const schedules = this.buildCharacterSchedules(
        episodes, analyses, characters, locationMap,
      );
      if (schedules.length > 0) {
        await this.prisma.characterSchedule.createMany({ data: schedules });
        scheduleCount = schedules.length;
      }

      // Step 6: Generate intro text with AI
      await this.generateIntroText(workId, episodes, workContext);

      // Step 7: Split episodes into StoryEvents
      const eventCount = await this.eventSplitter.splitAllEpisodes(workId);

      // Step 8: Experience script is generated separately via POST /generate-experience
      // (too slow for buildWorld — Sonnet batches take 5-10 min)

      // Mark as ready
      await this.prisma.work.update({
        where: { id: workId },
        data: { interactiveNovelStatus: 'ready', worldVersion: { increment: 1 } },
      });

      const result = {
        locations: extractedLocations.length,
        connections: connCount,
        renderings: renderCount,
        schedules: scheduleCount,
        events: eventCount,
        experienceScenes: 0,
      };
      this.logger.log(`World built: ${JSON.stringify(result)}`);
      return result;

    } catch (err) {
      await this.prisma.work.update({
        where: { id: workId },
        data: { interactiveNovelStatus: 'failed' },
      });
      throw err;
    }
  }

  /**
   * Extract locations from episode analyses or episode text.
   */
  private extractLocations(
    episodes: { id: string; orderIndex: number; content: string | null }[],
    analyses: any[],
  ): ExtractedLocation[] {
    const locationCounts = new Map<string, { desc: string; type: string; episodes: Set<number> }>();

    // From EpisodeAnalysis.locations (preferred)
    for (const analysis of analyses) {
      const locs = (analysis.locations as any[]) || [];
      const epIndex = analysis.episode?.orderIndex ?? 0;
      for (const loc of locs) {
        if (!loc.name) continue;
        // Normalize: strip parenthetical suffixes to merge duplicates
        // e.g. "詩のアパート（六畳一間）" → "詩のアパート"
        const normalized = loc.name.trim().replace(/[（(].+[）)]$/, '').trim();
        // Also check if this is a substring match of an existing key
        const existingKey = this.findSimilarLocationKey(locationCounts, normalized);
        const key = existingKey || normalized;
        const existing = locationCounts.get(key);
        if (existing) {
          existing.episodes.add(epIndex);
          if (loc.description && loc.description.length > existing.desc.length) {
            existing.desc = loc.description;
          }
        } else {
          locationCounts.set(key, {
            desc: loc.description || normalized,
            type: this.guessLocationType(normalized, loc.description || ''),
            episodes: new Set([epIndex]),
          });
        }
      }
    }

    // If no analyses, extract from episode text
    if (locationCounts.size === 0) {
      for (const ep of episodes) {
        if (!ep.content) continue;
        const detected = this.detectLocationsFromText(ep.content);
        for (const loc of detected) {
          const existing = locationCounts.get(loc.name);
          if (existing) {
            existing.episodes.add(ep.orderIndex);
          } else {
            locationCounts.set(loc.name, {
              desc: loc.description,
              type: loc.type,
              episodes: new Set([ep.orderIndex]),
            });
          }
        }
      }
    }

    // Convert to array, sort by frequency (most common locations first)
    return Array.from(locationCounts.entries())
      .map(([name, data]) => ({
        name,
        description: data.desc,
        type: data.type as 'interior' | 'exterior' | 'abstract',
        episodeIndices: Array.from(data.episodes).sort((a, b) => a - b),
      }))
      .sort((a, b) => b.episodeIndices.length - a.episodeIndices.length)
      .slice(0, 20); // Max 20 locations
  }

  /**
   * Detect locations from episode text when EpisodeAnalysis is not available.
   */
  private detectLocationsFromText(content: string): { name: string; description: string; type: string }[] {
    const locations: { name: string; description: string; type: string }[] = [];

    // Scene break sections often start with location descriptions
    const sections = content.split(/\n\s*\*\*\*\s*\n/);
    for (const section of sections) {
      const firstLine = section.trim().split('\n')[0]?.replace(/^　+/, '').trim();
      if (!firstLine || firstLine.startsWith('「')) continue;

      // Look for location indicators
      if (/の中|に入る|に着く|の前|の扉|の部屋/.test(firstLine) && firstLine.length < 50) {
        locations.push({
          name: firstLine.replace(/[。、].*$/, '').slice(0, 20),
          description: firstLine,
          type: /外|路地|通り|公園|空|街/.test(firstLine) ? 'exterior' : 'interior',
        });
      }
    }

    return locations;
  }

  /**
   * Find an existing location key that is similar to the given name.
   * Handles cases like "栞堂" vs "古書店『栞堂』" or "栞堂（古書店）".
   */
  private findSimilarLocationKey(
    locationCounts: Map<string, any>,
    normalized: string,
  ): string | null {
    for (const key of locationCounts.keys()) {
      // One contains the other (e.g., "栞堂" ⊂ "古書店『栞堂』")
      if (key.includes(normalized) || normalized.includes(key)) {
        // Keep the shorter (more canonical) name
        return key.length <= normalized.length ? key : key;
      }
    }
    return null;
  }

  private guessLocationType(name: string, desc: string): string {
    const text = name + desc;
    if (/外|路地|通り|公園|街|広場|森|海|山|川|空|庭/.test(text)) return 'exterior';
    if (/夢|記憶|心|精神|意識|仮想|システム|データ/.test(text)) return 'abstract';
    return 'interior';
  }

  /**
   * Infer location connections from co-occurrence in episodes.
   * If two locations appear in the same episode, they're likely connected.
   */
  private inferConnections(locations: ExtractedLocation[]): { from: string; to: string }[] {
    const connections: { from: string; to: string }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        // Check if they share any episodes
        const shared = locations[i].episodeIndices.some(e => locations[j].episodeIndices.includes(e));
        if (shared) {
          const key1 = `${locations[i].name}->${locations[j].name}`;
          const key2 = `${locations[j].name}->${locations[i].name}`;
          if (!seen.has(key1)) {
            connections.push({ from: locations[i].name, to: locations[j].name });
            connections.push({ from: locations[j].name, to: locations[i].name });
            seen.add(key1);
            seen.add(key2);
          }
        }
      }
    }

    return connections;
  }

  /**
   * Generate AI-powered literary sensory renderings for a location.
   * Calls Haiku to produce evocative, five-sense descriptions per time of day.
   * Falls back to template-based renderings on failure.
   */
  private async generateAiRenderings(
    loc: ExtractedLocation,
    episodes: { id: string; orderIndex: number; content: string | null }[],
    workContext?: { genre?: string; settingEra?: string; tone?: string; themes?: string[] },
    analyses?: { episodeIndex: number; tone?: string; summary?: string; locations?: any[] }[],
  ): Promise<{ timeOfDay: string; sensoryText: any }[]> {
    try {
      // Build rich context from EpisodeAnalysis metadata (no raw text truncation)
      const relevantAnalyses = (analyses || [])
        .filter(a => loc.episodeIndices.includes(a.episodeIndex));

      const contextParts: string[] = [];

      // Work-level context
      if (workContext?.genre) contextParts.push(`ジャンル: ${workContext.genre}`);
      if (workContext?.settingEra) contextParts.push(`時代・世界観: ${workContext.settingEra}`);

      // Episode-level context: tone, summaries, location descriptions from analysis
      const tones = relevantAnalyses.map(a => a.tone).filter(Boolean);
      if (tones.length > 0) contextParts.push(`作品のトーン: ${[...new Set(tones)].join('、')}`);

      const summaries = relevantAnalyses.map(a => a.summary).filter(Boolean).slice(0, 3);
      if (summaries.length > 0) contextParts.push(`関連エピソードのあらすじ:\n${summaries.join('\n')}`);

      // Location descriptions from analysis (these are already extracted by scoring)
      const locDescs = relevantAnalyses
        .flatMap(a => (a.locations || []) as any[])
        .filter((l: any) => l.name === loc.name && l.description)
        .map((l: any) => l.description);
      if (locDescs.length > 0) contextParts.push(`分析から抽出された場所の描写: ${[...new Set(locDescs)].join(' / ')}`);

      // Themes from work-level analysis
      if (workContext?.themes && workContext.themes.length > 0) {
        contextParts.push(`テーマ: ${workContext.themes.join('、')}`);
      }

      const systemPrompt = [
        'あなたは文学的な場所描写を生成する作家です。',
        '指定された場所について、時間帯ごとの五感描写をJSON形式で出力してください。',
        '',
        '各フィールドは1-2文の簡潔かつ文学的な描写にしてください。',
        '- visual: 視覚的な描写（光、色、形、動き）',
        '- auditory: 聴覚的な描写（音、静寂、響き）',
        '- olfactory: 嗅覚的な描写（匂い、香り、空気の質感）',
        '- atmospheric: 場の雰囲気・空気感（感情的トーン、身体感覚）',
        '',
        '時間帯による変化を明確に表現すること：',
        '- morning: 朝の光、目覚め、始まりの気配',
        '- afternoon: 昼の明るさ、活動、静けさ',
        '- evening: 夕暮れの色彩、影、一日の終わり',
        '',
        '出力形式（JSONのみ、他のテキスト不要）：',
        '{"morning":{"visual":"...","auditory":"...","olfactory":"...","atmospheric":"..."},',
        '"afternoon":{"visual":"...","auditory":"...","olfactory":"...","atmospheric":"..."},',
        '"evening":{"visual":"...","auditory":"...","olfactory":"...","atmospheric":"..."}}',
      ].join('\n');

      const userContent = [
        `場所名: ${loc.name}`,
        `場所の説明: ${loc.description}`,
        `場所タイプ: ${loc.type === 'exterior' ? '屋外' : loc.type === 'interior' ? '屋内' : '抽象的空間'}`,
        '',
        contextParts.length > 0
          ? `以下はこの場所が登場する作品の文脈情報です。作品の世界観やトーンを忠実に反映した描写を生成してください：\n\n${contextParts.join('\n')}`
          : '',
      ].join('\n');

      const apiKey = await this.aiSettings.getApiKey();
      if (!apiKey) {
        this.logger.warn(`No API key for AI rendering of "${loc.name}", using fallback`);
        return this.generateBasicRenderings(loc);
      }
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: HAIKU,
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!response.ok) {
        this.logger.warn(`AI rendering failed for "${loc.name}": HTTP ${response.status}`);
        return this.generateBasicRenderings(loc);
      }

      const data = await response.json();
      const text = data?.content?.[0]?.text || '';

      // Extract JSON from response (handle possible markdown code fences)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn(`AI rendering for "${loc.name}": no JSON found in response`);
        return this.generateBasicRenderings(loc);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const timePeriods = ['morning', 'afternoon', 'evening'];
      const renderings: { timeOfDay: string; sensoryText: any }[] = [];

      for (const period of timePeriods) {
        const sensory = parsed[period];
        if (sensory && typeof sensory === 'object') {
          renderings.push({
            timeOfDay: period,
            sensoryText: {
              visual: sensory.visual || loc.description,
              auditory: sensory.auditory || '',
              olfactory: sensory.olfactory || '',
              atmospheric: sensory.atmospheric || '',
            },
          });
        }
      }

      if (renderings.length === 0) {
        this.logger.warn(`AI rendering for "${loc.name}": parsed JSON had no valid time periods`);
        return this.generateBasicRenderings(loc);
      }

      this.logger.log(`AI rendering generated for "${loc.name}": ${renderings.length} time periods`);
      return renderings;

    } catch (err: any) {
      this.logger.warn(`AI rendering failed for "${loc.name}": ${err?.message}`);
      return this.generateBasicRenderings(loc);
    }
  }

  /**
   * Generate an atmospheric intro from the novel's opening text.
   * AI selects the best portion and natural cutoff point for entering the story world.
   * Stored as a special LocationRendering with timeOfDay='intro' on the first location.
   */
  private async generateIntroText(
    workId: string,
    episodes: { id: string; orderIndex: number; content: string | null }[],
    workContext?: { genre?: string; settingEra?: string },
  ): Promise<void> {
    const firstEp = episodes[0];
    if (!firstEp?.content) return;

    // Get first location to attach intro rendering to
    const firstLocation = await this.prisma.worldLocation.findFirst({
      where: { workId },
      orderBy: { createdAt: 'asc' },
    });
    if (!firstLocation) return;

    const opening = firstEp.content.slice(0, 3000);

    try {
      const apiKey = await this.aiSettings.getApiKey();
      if (!apiKey) {
        await this.saveFallbackIntro(firstLocation.id, opening);
        return;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: HAIKU,
          max_tokens: 600,
          system: [
            'あなたは小説のインタラクティブ体験の導入演出を設計するアシスタントです。',
            '',
            '小説の冒頭テキストを受け取り、読者が「物語の世界に入る」前に表示する導入文を構成してください。',
            '',
            'ルール:',
            '- 原文をそのまま活かす。創作・要約・改変はしない',
            '- 読者を物語の空気に引き込む自然な切れ目を見つける',
            '- 短すぎず長すぎず（2-4段落が理想）',
            '- 段落の途中で切らない。文の途中で切らない',
            '- セリフ（「」）が始まる直前で止めるのが自然なことが多い',
            '- 導入として余韻が残る位置を選ぶ',
            '',
            'JSON配列で返してください。各要素が1段落です。',
            '例: ["最初の段落。", "二番目の段落。"]',
          ].join('\n'),
          messages: [{
            role: 'user',
            content: [
              workContext?.genre ? `ジャンル: ${workContext.genre}` : '',
              workContext?.settingEra ? `世界観: ${workContext.settingEra}` : '',
              '',
              '以下の冒頭テキストから導入文を構成してください:',
              '',
              opening,
            ].filter(Boolean).join('\n'),
          }],
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Intro generation failed: HTTP ${response.status}`);
        await this.saveFallbackIntro(firstLocation.id, opening);
        return;
      }

      const data = await response.json();
      const text = data?.content?.[0]?.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        await this.saveFallbackIntro(firstLocation.id, opening);
        return;
      }

      const paragraphs = JSON.parse(jsonMatch[0]) as string[];
      if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
        await this.saveFallbackIntro(firstLocation.id, opening);
        return;
      }

      await this.prisma.locationRendering.upsert({
        where: { locationId_timeOfDay: { locationId: firstLocation.id, timeOfDay: 'intro' } },
        create: { locationId: firstLocation.id, timeOfDay: 'intro', sensoryText: { paragraphs } },
        update: { sensoryText: { paragraphs } },
      });

      this.logger.log(`Intro generated: ${paragraphs.length} paragraphs`);
    } catch (err: any) {
      this.logger.warn(`Intro generation failed: ${err?.message}`);
      await this.saveFallbackIntro(firstLocation.id, opening);
    }
  }

  private async saveFallbackIntro(locationId: string, opening: string): Promise<void> {
    // Fallback: take first 3 paragraphs from opening as-is
    const paragraphs = opening.split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p && p !== '***' && p !== '---')
      .slice(0, 3);

    if (paragraphs.length === 0) return;

    await this.prisma.locationRendering.upsert({
      where: { locationId_timeOfDay: { locationId, timeOfDay: 'intro' } },
      create: { locationId, timeOfDay: 'intro', sensoryText: { paragraphs } },
      update: { sensoryText: { paragraphs } },
    });
  }

  /**
   * Generate basic LocationRenderings from description text.
   * No AI call — just template-based sensory data. Used as fallback.
   */
  private generateBasicRenderings(loc: ExtractedLocation): { timeOfDay: string; sensoryText: any }[] {
    const base = {
      visual: loc.description,
      auditory: '',
      olfactory: '',
      atmospheric: loc.type === 'exterior' ? '開放的な空気。' : '静かな空間。',
    };

    // Generate for 2 time periods
    return [
      {
        timeOfDay: 'afternoon',
        sensoryText: { ...base, visual: `${loc.description}`, atmospheric: '穏やかな午後。' },
      },
      {
        timeOfDay: 'evening',
        sensoryText: { ...base, visual: `${loc.description} 光が暮れていく。`, atmospheric: '夕暮れの空気。' },
      },
    ];
  }

  /**
   * Build CharacterSchedules from EpisodeAnalysis.characters.
   */
  private buildCharacterSchedules(
    episodes: { id: string; orderIndex: number; content: string | null }[],
    analyses: any[],
    characters: { id: string; name: string }[],
    locationMap: Map<string, string>,
  ): any[] {
    const schedules: any[] = [];
    const workId = episodes[0] ? (analyses[0]?.workId || '') : '';
    if (!workId) return schedules;

    // Build analysis map by episode
    const analysisByEp = new Map<string, any>();
    for (const a of analyses) analysisByEp.set(a.episodeId, a);

    // For each episode, check which characters appear and where
    for (const ep of episodes) {
      const analysis = analysisByEp.get(ep.id);
      const basePos = ep.orderIndex / episodes.length;
      const span = 1 / episodes.length;

      if (analysis?.characters) {
        const epChars = analysis.characters as any[];
        for (const epChar of epChars) {
          if (!epChar.name) continue;

          // Match to StoryCharacter
          const matched = characters.find(c => {
            const shortName = c.name.split('（')[0].split('(')[0].trim().split(/\s/)[0];
            return shortName === epChar.name || c.name.includes(epChar.name) || epChar.name.includes(shortName);
          });
          if (!matched) continue;

          // Determine location from analysis locations
          let locationId: string | null = null;
          if (analysis.locations) {
            const locs = analysis.locations as any[];
            if (locs.length > 0) {
              // Use first location that we have in our map
              for (const loc of locs) {
                const id = locationMap.get(loc.name);
                if (id) { locationId = id; break; }
              }
            }
          }

          // If no location from analysis, use first location
          if (!locationId && locationMap.size > 0) {
            locationId = locationMap.values().next().value ?? null;
          }

          schedules.push({
            characterId: matched.id,
            workId,
            timeStart: basePos,
            timeEnd: basePos + span,
            locationId,
            activity: epChar.action || '',
            mood: '',
            episodeId: ep.id,
          });
        }
      } else if (ep.content) {
        // Fallback: detect characters from episode text
        for (const char of characters) {
          const shortName = char.name.split('（')[0].split('(')[0].trim().split(/\s/)[0];
          if (shortName.length >= 1 && ep.content.includes(shortName)) {
            const locationId = locationMap.size > 0 ? (locationMap.values().next().value ?? null) : null;
            schedules.push({
              characterId: char.id,
              workId,
              timeStart: basePos,
              timeEnd: basePos + span,
              locationId,
              activity: '',
              mood: '',
              episodeId: ep.id,
            });
          }
        }
      }
    }

    return schedules;
  }

  /**
   * Two-stage experience script generation.
   * Stage 1 (Sonnet): Read all episode summaries → design blueprint (scene structure, branches, perspective shifts)
   * Stage 2 (Haiku): For each episode, extract verbatim quotes and format JSON per blueprint
   * Core principle: "結果は変わらないが過程が変わる"
   */
  async generateExperienceScript(
    workId: string,
    episodes: { id: string; orderIndex: number; content: string | null }[],
    characters: { id: string; name: string; role: string | null; personality: string | null }[],
    workContext?: { genre?: string; settingEra?: string },
    onProgress?: (msg: string) => void,
  ): Promise<number> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) {
      this.logger.warn('No API key for experience script generation');
      return 0;
    }

    const sourceEpisodes = episodes.filter(e => e.content && e.content.length > 100);
    if (sourceEpisodes.length === 0) return 0;

    const charList = characters.map(c => {
      const short = c.name.split('（')[0].split('(')[0].trim().split(/[\s　]/)[0];
      let hash = 0;
      for (let i = 0; i < c.name.length; i++) hash = c.name.charCodeAt(i) + ((hash << 5) - hash);
      const hue = Math.abs(hash) % 360;
      return `${short}(${c.name}): ${c.role || ''}。色: hsl(${hue}, 25%, 55%)`;
    }).join('\n');

    // ===== STAGE 1: Sonnet designs the blueprint =====
    onProgress?.('Stage 1: Sonnetが全体設計中...');

    const episodeSummaries = sourceEpisodes.map(e => {
      const content = e.content!;
      const first = content.slice(0, 150).replace(/\n/g, ' ').trim();
      const last = content.slice(-100).replace(/\n/g, ' ').trim();
      const dlgCount = (content.match(/「[^」]+」/g) || []).length;
      return `第${e.orderIndex + 1}話 (${content.length}字, セリフ${dlgCount}): ${first}... / ...${last}`;
    }).join('\n');

    const blueprintPrompt = [
      'あなたは小説のインタラクティブ体験を設計する編集者です。',
      '',
      '以下の小説の全エピソード要約を読み、体験スクリプトの「設計図」をJSON形式で出力してください。',
      '',
      '## 核心原則',
      '「結果は変わらないが、過程が変わる」',
      '分岐は結末を変えない。読者がどの感情経路を通るかが変わる。',
      '同じ瞬間を別キャラの目で見ると、物語の意味が変わる（視点分岐）。',
      '',
      '## 出力形式（コンパクトに。JSONのみ）',
      '各話を1オブジェクトで。キーは "ep1"〜"ep21"。',
      '{"ep1":{"scenes":2,"key":"コーヒー,栞堂,蒼との出会い","awareness":"扉の向こうに朝の光がある","perspective":"榊:人間離れ発言の真意","memory":null,"next":"ep2"},...}',
      '- scenes: シーン数(2-5)',
      '- key: 引用すべき場面(カンマ区切り)',
      '- awareness: 選択肢テキスト(詩的に。無い話はnull)',
      '- perspective: 視点分岐(キャラ名:内容。無ければnull)',
      '- memory: 前話から呼び戻すテキスト(無ければnull)',
      '- next: 次の話のキー',
      '',
      'キャラクター: ' + charList.replace(/\n/g, ' / '),
      workContext?.genre ? `ジャンル: ${workContext.genre}` : '',
      '',
      episodeSummaries,
    ].filter(Boolean).join('\n');

    let blueprint: any = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300_000);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: blueprintPrompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.text().catch(() => '');
        this.logger.warn(`Stage 1 failed: HTTP ${response.status} ${err.slice(0, 200)}`);
        return 0;
      }

      const data = await response.json();
      const text = data?.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          blueprint = JSON.parse(jsonMatch[0]);
        } catch {
          // Repair truncated JSON
          let repaired = jsonMatch[0];
          let braces = 0, brackets = 0;
          for (const ch of repaired) {
            if (ch === '{') braces++;
            else if (ch === '}') braces--;
            else if (ch === '[') brackets++;
            else if (ch === ']') brackets--;
          }
          repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '');
          repaired = repaired.replace(/,\s*$/, '');
          for (let i = 0; i < brackets; i++) repaired += ']';
          for (let i = 0; i < braces; i++) repaired += '}';
          blueprint = JSON.parse(repaired);
          this.logger.log('Stage 1: repaired truncated blueprint JSON');
        }
        this.logger.log(`Stage 1 complete: blueprint generated`);
        onProgress?.(`Stage 1 完了: 設計図生成`);
      }
    } catch (err: any) {
      this.logger.warn(`Stage 1 failed: ${err?.message}`);
      onProgress?.(`Stage 1 失敗: ${err?.message}`);
      return 0;
    }

    if (!blueprint) return 0;

    // ===== STAGE 2: Haiku extracts quotes and formats JSON per episode =====
    onProgress?.('Stage 2: Haikuが各話のスクリプトを生成中...');

    const stage2System = [
      'あなたは小説の原文から体験スクリプトのJSONを生成するアシスタントです。',
      '',
      '設計図に従い、小説本文から正確な引用を抜き出してJSONを組み立ててください。',
      '',
      '## ブロックタイプ',
      '- original: {type:"original", text:"..."} 本文からそのまま引用。一字一句変えない。最も重要。1ブロック=1-3文',
      '- dialogue: {type:"dialogue", text:"「...」", speaker:"名前", speakerColor:"hsl(H,25%,55%)"} セリフ',
      '- environment: {type:"environment", text:"..."} 五感描写（1-2文）。これだけ創作可',
      '- memory: {type:"memory", text:"..."} 前の話のテキストの残響（italic表示）',
      '- scene-break: {type:"scene-break", text:"* * *"}',
      '',
      '## シーンID命名規則（厳守）',
      'IDは必ず ep{話数}_{場面の英語名} 形式にすること。',
      '例: ep1_coffee_shop, ep1_meeting_aoi, ep3_night_call, ep15_system_error',
      '絶対に scene1, scene_1, scene_a のような汎用名を使わないこと。',
      '',
      '## シーン数の目安',
      '1話あたり3-6シーンが適切。場面転換ごとに新シーンを作る。',
      '1シーン内にoriginalブロックは3-8個（十分な引用量を確保）。',
      '',
      '## awareness（気づき）',
      'シーン内で読者が選択できるポイント。各シーンに0-2個。',
      '形式: "awareness":[{"text":"詩的な短文","type":"感情経路の種類","target":"遷移先シーンID"}]',
      'type: "emotional"(感情を深める) / "perspective"(別キャラの視点) / "memory"(過去との接続)',
      'awareness.target は次のシーンIDか、perspectiveの場合は ep{N}_perspective_{キャラ名} 形式のシーンID',
      '',
      '## perspective（視点分岐シーン）',
      '設計図にperspectiveが指定されている場合、通常シーンとは別に視点分岐シーンも生成すること。',
      'ID例: ep3_perspective_aoi（蒼の視点で同じ瞬間を見る）',
      '視点分岐シーンのblocksは、そのキャラの内面描写を中心に構成（原文引用+environment）。',
      '',
      '## 出力: JSONのみ（他のテキスト不要）',
      '{"scenes":{"ep1_opening":{"header":"場所|時間|視点","blocks":[...],"awareness":[...],"continues":"ep1_next_scene"}}}',
      'introが必要な場合: {"intro":{"blocks":[...],"awareness":{"text":"...","target":"ep1_first_scene"}},"scenes":{...}}',
    ].join('\n');

    const allScenes: Record<string, any> = {};
    let introData: any = null;

    for (let i = 0; i < sourceEpisodes.length; i++) {
      const ep = sourceEpisodes[i];
      const epNum = ep.orderIndex + 1;
      const epBlueprint = blueprint[`ep${epNum}`] || blueprint[`episode_${epNum}`]
        || blueprint.episodes?.[i] || blueprint.episodes?.[`ep${epNum}`]
        || JSON.stringify(blueprint).slice(0, 500); // fallback: pass some context

      const isFirst = i === 0;
      const isLast = i === sourceEpisodes.length - 1;

      const blueprintStr = typeof epBlueprint === 'string' ? epBlueprint : JSON.stringify(epBlueprint, null, 2);

      const stage2Prompt = [
        `第${epNum}話（全${sourceEpisodes.length}話中）の体験スクリプトを生成してください。`,
        '',
        isFirst ? 'これは最初の話です。introセクション（冒頭の情景描写4-5行 + awareness1つで最初のシーンへ導く）も生成してください。' : '',
        isLast ? 'これは最後の話です。体験の締めくくり。最後のシーンのawarenessは空配列に。' : '',
        '',
        `## この話の設計図`,
        blueprintStr,
        '',
        `## シーンID規則（厳守）`,
        `全てのシーンIDは ep${epNum}_ で始めること。例: ep${epNum}_opening, ep${epNum}_dialogue_park`,
        `視点分岐シーンは ep${epNum}_perspective_{キャラ名} 形式。`,
        `continues先のシーンIDも ep${epNum}_ か ep${epNum + 1}_ で始めること。`,
        '',
        `## 品質チェックリスト`,
        `- シーン数: ${typeof epBlueprint === 'object' && epBlueprint?.scenes ? epBlueprint.scenes : '3-6'}個`,
        `- 各シーンにoriginalブロック3個以上（本文の重要な文をそのまま引用）`,
        `- dialogueブロックにはspeakerとspeakerColorを必ず付与`,
        typeof epBlueprint === 'object' && epBlueprint?.perspective ? `- 視点分岐シーン（${epBlueprint.perspective}）を必ず生成` : '',
        typeof epBlueprint === 'object' && epBlueprint?.awareness ? `- awarenessテキスト: 「${epBlueprint.awareness}」を活用` : '',
        '',
        'キャラクター:',
        charList,
        '',
        `=== 第${epNum}話 本文 ===`,
        ep.content!.slice(0, 8000),
      ].filter(Boolean).join('\n');

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: HAIKU,
            max_tokens: 6000,
            system: stage2System,
            messages: [{ role: 'user', content: stage2Prompt }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          this.logger.warn(`Stage 2 ep${epNum} failed: HTTP ${response.status}`);
          onProgress?.(`第${epNum}話: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const text = data?.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          this.logger.warn(`Stage 2 ep${epNum}: no JSON`);
          continue;
        }

        let epScript: any;
        try {
          epScript = JSON.parse(jsonMatch[0]);
        } catch {
          // Repair truncated JSON
          let repaired = jsonMatch[0];
          let braces = 0, brackets = 0;
          for (const ch of repaired) {
            if (ch === '{') braces++;
            else if (ch === '}') braces--;
            else if (ch === '[') brackets++;
            else if (ch === ']') brackets--;
          }
          repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '');
          repaired = repaired.replace(/,\s*$/, '');
          for (let j = 0; j < brackets; j++) repaired += ']';
          for (let j = 0; j < braces; j++) repaired += '}';
          try {
            epScript = JSON.parse(repaired);
          } catch {
            this.logger.warn(`Stage 2 ep${epNum}: JSON repair failed`);
            onProgress?.(`第${epNum}話: JSON修復失敗`);
            continue;
          }
        }

        // Post-process: ensure all scene IDs are prefixed with ep{N}_
        if (epScript.scenes) {
          const renamedScenes: Record<string, any> = {};
          const renameMap: Record<string, string> = {};

          for (const [sid, scene] of Object.entries(epScript.scenes)) {
            let newId = sid;
            if (!sid.startsWith(`ep${epNum}_`)) {
              // Strip generic prefixes and add proper prefix
              newId = `ep${epNum}_${sid.replace(/^(scene_?|ep\d+_?)/, '')}`;
            }
            renameMap[sid] = newId;
            renamedScenes[newId] = scene;
          }

          // Fix continues/target references within scenes
          for (const scene of Object.values(renamedScenes) as any[]) {
            if (scene.continues && renameMap[scene.continues]) {
              scene.continues = renameMap[scene.continues];
            }
            if (Array.isArray(scene.awareness)) {
              for (const aw of scene.awareness) {
                if (aw.target && renameMap[aw.target]) {
                  aw.target = renameMap[aw.target];
                }
              }
            }
          }

          epScript.scenes = renamedScenes;
        }

        if (isFirst && epScript.intro) {
          introData = epScript.intro;
          // Fix intro awareness target
          if (introData.awareness?.target) {
            const firstSceneId = Object.keys(epScript.scenes || {})[0];
            if (firstSceneId && !Object.keys(epScript.scenes || {}).includes(introData.awareness.target)) {
              introData.awareness.target = firstSceneId;
            }
          }
        }
        if (epScript.scenes) {
          for (const [sid, scene] of Object.entries(epScript.scenes)) {
            allScenes[sid] = scene;
          }
        }

        const sceneCount = Object.keys(epScript.scenes || {}).length;
        onProgress?.(`第${epNum}話: ${sceneCount}シーン`);
        this.logger.log(`Stage 2 ep${epNum}: ${sceneCount} scenes`);

      } catch (err: any) {
        this.logger.warn(`Stage 2 ep${epNum} failed: ${err?.message}`);
        onProgress?.(`第${epNum}話 失敗: ${err?.message}`);
        continue;
      }
    }

    if (!introData && Object.keys(allScenes).length === 0) {
      this.logger.warn('Experience script: no output from any stage');
      return 0;
    }

    if (!introData) {
      const firstSceneId = Object.keys(allScenes)[0];
      introData = {
        blocks: [{ type: 'original', text: '......' }],
        awareness: { text: '物語の中へ。', target: firstSceneId },
      };
    }

    const finalScript = { intro: introData, scenes: allScenes };
    await this.prisma.work.update({
      where: { id: workId },
      data: { experienceScript: finalScript },
    });

    const totalScenes = Object.keys(allScenes).length;
    this.logger.log(`Experience script complete: ${totalScenes} scenes`);
    return totalScenes;
  }
}
