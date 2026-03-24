import { Injectable, Logger, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { CreditService } from '../billing/credit.service';
import { CharacterTalkRevenueService } from './character-talk-revenue.service';
import { CharacterExtractionService } from './character-extraction.service';

const HAIKU = 'claude-haiku-4-5-20251001';
const MAX_WORK_TEXT_LENGTH = 20000;
const MAX_STRUCTURED_CONTEXT_LENGTH = 3000;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamChatOptions {
  mode: 'character' | 'companion';
  characterId?: string;
  useSonnet?: boolean;
}

@Injectable()
export class CharacterTalkService {
  private readonly logger = new Logger(CharacterTalkService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private creditService: CreditService,
    private revenueService: CharacterTalkRevenueService,
    private characterExtraction: CharacterExtractionService,
  ) {}

  async *streamChat(
    userId: string,
    workId: string,
    userMessage: string,
    options: StreamChatOptions,
  ): AsyncGenerator<string> {
    const { mode, characterId, useSonnet } = options;

    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    // Check if author has disabled character talk for this work
    const workSettings = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { enableCharacterTalk: true },
    });
    if (workSettings && !workSettings.enableCharacterTalk) {
      throw new ForbiddenException('この作品ではキャラクタートークが無効になっています');
    }

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    // User chooses: Haiku (1cr) or Sonnet (3cr)
    let model: string;
    let cost: number;

    if (useSonnet) {
      const sonnet = await this.aiSettings.getModel();
      model = sonnet;
      cost = 2;
    } else {
      model = HAIKU;
      cost = 1;
    }

    // Consume credits BEFORE the API call (two-phase commit)
    const { transactionId, purchasedDeducted } = await this.creditService.consumeCredits(
      userId,
      cost,
      'character_talk',
      model,
    );

    // Load or create conversation (use findFirst, not findUnique, due to nullable characterId)
    let conversation = await this.prisma.aiConversation.findFirst({
      where: {
        userId,
        workId,
        mode,
        characterId: mode === 'character' ? characterId : null,
      },
    });

    const existingMessages: ChatMessage[] = conversation
      ? (conversation.messages as unknown as ChatMessage[])
      : [];

    // Load work, reading progress, and structured data
    const [work, progress, publicCharacters, storyArc, creationPlan, episodeAnalyses] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        include: {
          episodes: {
            orderBy: { orderIndex: 'asc' },
            select: { id: true, title: true, content: true, orderIndex: true },
          },
        },
      }),
      this.prisma.readingProgress.findMany({
        where: { userId, workId },
        select: { episodeId: true, completed: true, progressPct: true },
      }),
      this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { id: true, name: true, role: true, personality: true, motivation: true, speechStyle: true, firstPerson: true, background: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.storyArc.findUnique({
        where: { workId },
        select: { premise: true, centralConflict: true, themes: true },
      }),
      this.prisma.workCreationPlan.findUnique({
        where: { workId },
        select: { emotionBlueprint: true, worldBuildingData: true },
      }),
      this.prisma.episodeAnalysis.findMany({
        where: { workId },
        select: { episode: { select: { orderIndex: true } }, characters: true },
        orderBy: { episode: { orderIndex: 'asc' } },
      }),
    ]);

    if (!work) {
      await this.creditService.refundTransaction(transactionId);
      throw new NotFoundException('Work not found');
    }

    // Calculate reading progress
    const hasReadAnything = progress.length > 0;
    const currentEpisodeIndex = hasReadAnything
      ? Math.max(
          ...progress.map((p) => {
            const ep = work.episodes.find((e) => e.id === p.episodeId);
            return ep ? ep.orderIndex : 0;
          }),
          0,
        )
      : -1; // -1 means not read at all

    // Collect character names from all episodes up to reader's progress
    const appearedCharNames = new Set<string>();
    if (hasReadAnything) {
      for (const ea of episodeAnalyses) {
        if (ea.episode.orderIndex <= currentEpisodeIndex && Array.isArray(ea.characters)) {
          for (const c of ea.characters as any[]) {
            if (c.name) appearedCharNames.add(c.name);
          }
        }
      }
    }

    // Build structured context (spoiler-safe)
    const structuredParts: string[] = [];

    // If unread, use all public characters (no spoiler risk since no story context is given)
    // If read, filter to only characters that appeared in read episodes (fuzzy name match)
    const safeChars = hasReadAnything && appearedCharNames.size > 0
      ? this.matchStoryCharactersForContext(publicCharacters, appearedCharNames)
      : publicCharacters;
    if (safeChars.length > 0) {
      const charLines = safeChars.map((c) =>
        `- ${c.name} (${c.role}): ${[c.personality, c.motivation, c.speechStyle ? `口調:${c.speechStyle}` : ''].filter(Boolean).join('、')}`,
      ).join('\n');
      structuredParts.push(`【登場人物情報】\n${charLines}`);
    }

    const wb = creationPlan?.worldBuildingData as any;
    if (wb) {
      const wbLines: string[] = [];
      if (wb.basics?.era) wbLines.push(`時代: ${wb.basics.era}`);
      if (wb.basics?.setting) wbLines.push(`舞台: ${wb.basics.setting}`);
      for (const term of (Array.isArray(wb.terminology) ? wb.terminology : []).slice(0, 10)) {
        if (term.term) wbLines.push(`${term.term}: ${term.definition}`);
      }
      for (const rule of (Array.isArray(wb.rules) ? wb.rules : []).slice(0, 5)) {
        if (rule.name) wbLines.push(`${rule.name}: ${rule.description}`);
      }
      if (wbLines.length > 0) structuredParts.push(`【世界観】\n${wbLines.join('\n')}`);
    }

    if (storyArc) {
      const themeLines: string[] = [];
      if (storyArc.premise) themeLines.push(`前提: ${storyArc.premise}`);
      if (storyArc.centralConflict) themeLines.push(`中心的葛藤: ${storyArc.centralConflict}`);
      if (Array.isArray(storyArc.themes) && storyArc.themes.length > 0) {
        themeLines.push(`テーマ: ${storyArc.themes.join('、')}`);
      }
      if (themeLines.length > 0) structuredParts.push(`【物語のテーマ】\n${themeLines.join('\n')}`);
    }

    const structuredContext = structuredParts.join('\n\n').slice(0, MAX_STRUCTURED_CONTEXT_LENGTH);

    // Build work text (reader's read range only; empty if unread)
    let workText = '';
    if (hasReadAnything) {
      const readEpisodes = work.episodes.filter((e) => e.orderIndex <= currentEpisodeIndex);
      const fullText = readEpisodes.map((e) => e.content).join('\n\n');
      workText = fullText.slice(0, MAX_WORK_TEXT_LENGTH);
    }

    // Build system prompt based on mode
    let systemPrompt: string;

    if (mode === 'character' && characterId) {
      const character = publicCharacters.find((c) => c.id === characterId);
      if (!character) {
        await this.creditService.refundTransaction(transactionId);
        throw new NotFoundException('Character not found');
      }

      // Spoiler protection is handled by:
      // 1. isPublic flag (author controls character visibility)
      // 2. System prompt (tells AI the reader's progress)
      // 3. Work text limited to read episodes only

      const readStatusNote = hasReadAnything
        ? `- 読者は第${currentEpisodeIndex + 1}話まで読んでいます。それ以降の展開は知らないものとして振る舞ってください。`
        : `- 読者はまだ作品を読んでいません。物語の具体的な展開やネタバレは一切話さないでください。読者が興味を持つように、あなた自身のことや世界観について話してください。`;

      systemPrompt = `あなたは${character.name}です。「${work.title}」の世界に生きています。

話しかけてくるのは、あなたの物語を読んでいる一人の読者です。作者ではありません。
あなたはこの読者と初めて会話しています。自然に、${character.name}らしく振る舞ってください。

【あなた自身のこと】
- 名前: ${character.name}
- 役割: ${character.role}
- 一人称: ${character.firstPerson || '私'}
- 性格: ${character.personality}
- 口調: ${character.speechStyle}
- 動機: ${character.motivation}
- 背景: ${character.background}

【守ること】
- 最初から${character.name}として自然に話してください。「${character.name}として答えます」のような前置きは絶対にしないでください。
- 他のキャラクターになりきったり、他のキャラクターの台詞を代弁しないでください。
- 会話相手は読者一人だけです。他の登場人物との会話を始めないでください。
- 一人称は「${character.firstPerson || '私'}」を使ってください。
- あなたがAIであること、フィクションのキャラクターであることには言及しないでください。
${readStatusNote}
- 日本語で会話してください。

${structuredContext}${workText ? `\n\n作品テキスト（読者の既読範囲）:\n${workText}` : ''}`;
    } else {
      // Companion mode
      const readStatusNote = hasReadAnything
        ? `- 読者は第${currentEpisodeIndex + 1}話まで読んでいます。それ以降のネタバレは絶対にしないでください。\n- 読者が読んだ範囲の内容について、深い考察や感想を共有してください。`
        : `- 読者はまだ作品を読んでいません。ネタバレは一切しないでください。\n- 作品の雰囲気やジャンル、読み始めるきっかけになるような話をしてください。`;

      systemPrompt = `あなたは「${work.title}」の読書コンパニオンAIです。読者と作品について語り合います。

重要なルール:
${readStatusNote}
- 質問には親切に、しかし未読部分の内容は明かさないでください。
- 登場人物の名前、性格、口調を以下の情報から正確に参照してください。
- 世界観の用語や設定を正確に使用してください。
- 日本語で回答してください。
${structuredContext ? `\n${structuredContext}\n` : ''}${workText ? `\n作品テキスト（読者の既読範囲）:\n${workText}` : ''}`;
    }

    // Build messages array for Claude
    const messages: ChatMessage[] = [
      ...existingMessages.slice(-20),
      { role: 'user', content: userMessage },
    ];

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let assistantResponse = '';
    let streamError = false;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          stream: true,
          system: [
            {
              type: 'text' as const,
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Claude API error: ${response.status} ${errorText}`);
        streamError = true;
        throw new ServiceUnavailableException('AI service error');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        streamError = true;
        throw new ServiceUnavailableException('No response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;

            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                assistantResponse += event.delta.text;
                yield event.delta.text;
              }
              if (event.type === 'message_start' && event.message?.usage) {
                inputTokens = event.message.usage.input_tokens || 0;
              }
              if (event.type === 'message_delta' && event.usage) {
                outputTokens = event.usage.output_tokens || 0;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (e) {
      streamError = true;
      throw e;
    } finally {
      if (streamError) {
        // Refund on error
        await this.creditService.refundTransaction(transactionId);
      } else {
        // Confirm transaction on success
        await this.creditService.confirmTransaction(transactionId);

        // Record revenue if purchased credits were used
        if (purchasedDeducted > 0) {
          const authorId = work.authorId;
          await this.revenueService.recordRevenue(
            authorId,
            userId,
            workId,
            mode === 'character' ? (characterId || null) : null,
            mode,
            cost,
            purchasedDeducted,
            transactionId,
          );
        }
      }

      // Save conversation
      const updatedMessages: ChatMessage[] = [
        ...existingMessages,
        { role: 'user', content: userMessage },
        ...(assistantResponse ? [{ role: 'assistant' as const, content: assistantResponse }] : []),
      ];

      if (conversation) {
        await this.prisma.aiConversation.update({
          where: { id: conversation.id },
          data: { messages: updatedMessages as any, messageCount: updatedMessages.length },
        }).catch((e) => this.logger.error('Failed to save conversation', e));
      } else {
        await this.prisma.aiConversation.create({
          data: {
            userId,
            workId,
            mode,
            characterId: mode === 'character' ? (characterId || null) : null,
            messages: updatedMessages as any,
            messageCount: updatedMessages.length,
          },
        }).catch((e) => this.logger.error('Failed to save conversation', e));
      }

      // Log usage
      const durationMs = Date.now() - startTime;
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          feature: 'character_talk',
          inputTokens,
          outputTokens,
          model,
          durationMs,
        },
      }).catch((e) => this.logger.error('Failed to log AI usage', e));
    }
  }

  /**
   * Get characters available for talk from the reader's most recently read episode.
   * Priority: episodeAnalysis.characters (free) → extractedCharacters (Haiku fallback).
   * Only characters with StoryCharacter settings are talkable.
   */
  async getAvailableCharacters(userId: string, workId: string, episodeId?: string) {
    const [work, allCharacters] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        select: {
          enableCharacterTalk: true,
          episodes: {
            where: { publishedAt: { not: null } },
            select: {
              id: true,
              orderIndex: true,
              extractedCharacters: true,
              aiAnalysis: { select: { characters: true } },
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
      }),
      this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { id: true, name: true, role: true, personality: true, speechStyle: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    if (!work) throw new NotFoundException('Work not found');
    if (!work.enableCharacterTalk) return [];

    // Use specified episode, or fall back to most recently read
    let targetEpisode: typeof work.episodes[number] | null = null;

    if (episodeId) {
      targetEpisode = work.episodes.find((ep) => ep.id === episodeId) || null;
    }

    if (!targetEpisode) {
      // Fall back to most recently read episode
      const progress = await this.prisma.readingProgress.findMany({
        where: { userId, workId },
        select: { episodeId: true },
      });
      const readEpisodeIds = new Set(progress.map((p) => p.episodeId));

      for (const ep of work.episodes) {
        if (readEpisodeIds.has(ep.id)) {
          if (!targetEpisode || ep.orderIndex > targetEpisode.orderIndex) {
            targetEpisode = ep;
          }
        }
      }
    }

    if (!targetEpisode) {
      return [];
    }

    // Priority 1: extractedCharacters (dedicated Haiku extraction — most accurate)
    const extractedChars = targetEpisode.extractedCharacters as any[] | null;
    if (Array.isArray(extractedChars) && extractedChars.length > 0) {
      const names = new Set(extractedChars.map((c: any) => c.name).filter(Boolean));
      const matched = this.matchStoryCharacters(allCharacters, names);
      this.logger.log(`[charTalk] ep=${targetEpisode.id} extracted=[${[...names].join(',')}] storyChars=[${allCharacters.map(c=>c.name).join(',')}] matched=${matched.length}`);
      return matched;
    }

    // Priority 2: episodeAnalysis.characters (from scoring, free fallback)
    const analysisChars = targetEpisode.aiAnalysis?.characters as any[] | null;
    if (Array.isArray(analysisChars) && analysisChars.length > 0) {
      const names = new Set(analysisChars.map((c: any) => c.name).filter(Boolean));
      this.logger.log(`[charTalk] ep=${targetEpisode.id} analysis=[${[...names].join(',')}] storyChars=[${allCharacters.map(c=>c.name).join(',')}] (fallback)`);
      this.characterExtraction.triggerIfNeeded(targetEpisode.id);
      return this.matchStoryCharacters(allCharacters, names);
    }

    // Neither exists — trigger extraction, return empty for now
    this.logger.log(`[charTalk] ep=${targetEpisode.id} no character data, triggering extraction`);
    this.characterExtraction.triggerIfNeeded(targetEpisode.id);
    return [];
  }

  /** Normalize a name for matching: strip spaces, parenthetical readings, punctuation */
  private normalizeName(name: string): string {
    return name
      .replace(/[（(][^）)]*[）)]/g, '') // Remove parenthetical readings e.g. （あやせ うた）
      .replace(/[\s　・]/g, '')           // Remove spaces, fullwidth spaces, middle dots
      .trim();
  }

  /** Match extracted character names against StoryCharacter settings (fuzzy) */
  private matchStoryCharacters(
    allCharacters: { id: string; name: string; role: string; personality: string | null; speechStyle: string | null }[],
    names: Set<string>,
  ) {
    const normalizedNames = [...names].map((n) => this.normalizeName(n));

    return allCharacters.filter((c) => {
      const normalizedChar = this.normalizeName(c.name);

      for (let i = 0; i < normalizedNames.length; i++) {
        const extractedName = normalizedNames[i];
        const rawName = [...names][i];
        // Exact match (original or normalized)
        if (c.name === rawName || normalizedChar === extractedName) return true;
        // Substring match (original)
        if (c.name.includes(rawName) || rawName.includes(c.name)) return true;
        // Substring match (normalized)
        if (normalizedChar.includes(extractedName) || extractedName.includes(normalizedChar)) return true;
      }
      return false;
    });
  }

  /**
   * Get all conversations across all works for a user.
   * Includes work info, character name, last message, and reading progress.
   */
  async getAllConversations(userId: string) {
    const conversations = await this.prisma.aiConversation.findMany({
      where: { userId },
      select: {
        id: true,
        workId: true,
        mode: true,
        characterId: true,
        messageCount: true,
        messages: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50, // Limit to prevent excessive memory usage
    });

    if (conversations.length === 0) return [];

    // Collect unique workIds and characterIds
    const workIds = [...new Set(conversations.map((c) => c.workId))];
    const characterIds = conversations
      .map((c) => c.characterId)
      .filter((id): id is string => !!id);

    // Parallel fetch: works, characters, reading progress
    const [works, characters, progressRecords] = await Promise.all([
      this.prisma.work.findMany({
        where: { id: { in: workIds } },
        select: {
          id: true,
          title: true,
          episodes: {
            where: { publishedAt: { not: null } },
            select: { id: true, orderIndex: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      }),
      characterIds.length > 0
        ? this.prisma.storyCharacter.findMany({
            where: { id: { in: characterIds } },
            select: { id: true, name: true },
          })
        : [],
      this.prisma.readingProgress.findMany({
        where: { userId, workId: { in: workIds } },
        select: { workId: true, episodeId: true },
      }),
    ]);

    const workMap = new Map(works.map((w) => [w.id, w]));
    const charMap = new Map(characters.map((c) => [c.id, c.name]));

    // Calculate reading progress per work
    const readProgressMap = new Map<string, { readCount: number; totalCount: number }>();
    for (const w of works) {
      const readEpisodeIds = new Set(
        progressRecords.filter((p) => p.workId === w.id).map((p) => p.episodeId),
      );
      readProgressMap.set(w.id, {
        readCount: readEpisodeIds.size,
        totalCount: w.episodes.length,
      });
    }

    return conversations.map((c) => {
      const work = workMap.get(c.workId);
      const msgs = Array.isArray(c.messages) ? c.messages as any[] : [];
      const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const progress = readProgressMap.get(c.workId);

      return {
        id: c.id,
        workId: c.workId,
        workTitle: work?.title || null,
        mode: c.mode,
        characterId: c.characterId,
        characterName: c.characterId ? charMap.get(c.characterId) || null : null,
        messageCount: c.messageCount,
        lastMessage: lastMessage ? {
          role: lastMessage.role,
          content: typeof lastMessage.content === 'string'
            ? lastMessage.content.slice(0, 100)
            : '',
        } : null,
        readProgress: progress || null,
        updatedAt: c.updatedAt,
      };
    });
  }

  /** Filter characters by fuzzy matching against appeared names (for system prompt context) */
  private matchStoryCharactersForContext(
    characters: { id: string; name: string; role: string; personality: string | null; motivation: string | null; speechStyle: string | null; firstPerson: string | null; background: string | null }[],
    names: Set<string>,
  ) {
    const normalizedNames = [...names].map((n) => this.normalizeName(n));
    return characters.filter((c) => {
      const normalizedChar = this.normalizeName(c.name);
      for (let i = 0; i < normalizedNames.length; i++) {
        const extractedName = normalizedNames[i];
        const rawName = [...names][i];
        if (c.name === rawName || normalizedChar === extractedName) return true;
        if (c.name.includes(rawName) || rawName.includes(c.name)) return true;
        if (normalizedChar.includes(extractedName) || extractedName.includes(normalizedChar)) return true;
      }
      return false;
    });
  }

  /**
   * Get all conversations for a user + work.
   */
  async getConversations(userId: string, workId: string) {
    const conversations = await this.prisma.aiConversation.findMany({
      where: { userId, workId },
      select: {
        id: true,
        mode: true,
        characterId: true,
        messageCount: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Enrich with character names
    const characterIds = conversations
      .map((c) => c.characterId)
      .filter((id): id is string => !!id);

    const characters = characterIds.length > 0
      ? await this.prisma.storyCharacter.findMany({
          where: { id: { in: characterIds } },
          select: { id: true, name: true },
        })
      : [];

    const charMap = new Map(characters.map((c) => [c.id, c.name]));

    return conversations.map((c) => ({
      mode: c.mode,
      characterId: c.characterId,
      characterName: c.characterId ? charMap.get(c.characterId) || null : null,
      messageCount: c.messageCount,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * Get conversation history.
   */
  async getHistory(userId: string, workId: string, characterId?: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: {
        userId,
        workId,
        mode: characterId ? 'character' : 'companion',
        characterId: characterId || null,
      },
    });
    return { messages: conversation?.messages || [] };
  }

  /**
   * Clear a conversation.
   */
  async clearConversation(userId: string, workId: string, characterId?: string, mode?: string) {
    await this.prisma.aiConversation.deleteMany({
      where: {
        userId,
        workId,
        mode: mode || (characterId ? 'character' : 'companion'),
        characterId: characterId || null,
      },
    });
    return { deleted: true };
  }
}
