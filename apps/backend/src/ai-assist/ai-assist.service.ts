import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService, CreditEstimate } from '../ai-settings/ai-tier.service';
import { PromptTemplatesService } from '../prompt-templates/prompt-templates.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { CreditService } from '../billing/credit.service';

const MAX_CONTENT_LENGTH = 15000;
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

// In-memory rate limiter: userId -> timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 20;

@Injectable()
export class AiAssistService {
  private readonly logger = new Logger(AiAssistService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private aiTier: AiTierService,
    private templates: PromptTemplatesService,
    private contextBuilder: AiContextBuilderService,
    private creditService: CreditService,
  ) {}

  async checkStatus(userId?: string): Promise<{
    available: boolean;
    model: string;
    tier?: { plan: string; canUseAi: boolean; canUseThinking: boolean; canUseOpus: boolean; remainingFreeUses: number | null; credits?: { total: number; monthly: number; purchased: number } };
  }> {
    const enabled = await this.aiSettings.isAiEnabled();
    const model = await this.aiSettings.getModel();
    if (!enabled) return { available: false, model };
    const apiKey = await this.aiSettings.getApiKey();
    const available = !!apiKey;

    if (userId && available) {
      const tier = await this.aiTier.getUserTier(userId);
      return { available, model, tier };
    }

    return { available, model };
  }

  checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const timestamps = rateLimitMap.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) return false;
    recent.push(now);
    rateLimitMap.set(userId, recent);
    return true;
  }

  /** Build the prompt from a template + variables (shared by streamAssist and estimateCost) */
  private async buildPrompt(
    templateSlug: string,
    variables: Record<string, string>,
  ): Promise<{ prompt: string; structuralContext: string | null }> {
    const template = await this.templates.findBySlug(templateSlug);

    // Auto-inject structural context if workId is provided
    if (variables.workId && !variables.structural_context) {
      try {
        const episodeOrder = variables.episodeOrder
          ? parseInt(variables.episodeOrder, 10)
          : 999;
        const ctx = await this.contextBuilder.buildContext(
          variables.workId,
          episodeOrder,
        );
        const formatted = this.contextBuilder.formatForPrompt(ctx);
        if (formatted) {
          variables.structural_context = formatted;
        }
      } catch (e) {
        this.logger.warn(`Failed to build structural context: ${e}`);
      }
    }

    let prompt = template.prompt;

    // Handle conditional sections
    for (const [key, value] of Object.entries(variables)) {
      const sectionRegex = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{/${key}\\}\\}`, 'g');
      if (value && value.trim()) {
        prompt = prompt.replace(sectionRegex, '$1');
      } else {
        prompt = prompt.replace(sectionRegex, '');
      }
    }
    prompt = prompt.replace(/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/g, '');

    // Replace variable placeholders
    for (const [key, value] of Object.entries(variables)) {
      const truncated = value.slice(0, MAX_CONTENT_LENGTH);
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), truncated);
    }

    if (variables.custom_instruction) {
      prompt += `\n\n【著者からの追加指示】\n${variables.custom_instruction}`;
    }

    return { prompt, structuralContext: variables.structural_context || null };
  }

  /** Estimate credit cost for a writing assist call (no LLM call) */
  async estimateCost(
    userId: string,
    templateSlug: string,
    variables: Record<string, string>,
    premiumMode: boolean = false,
    aiMode?: 'normal' | 'thinking' | 'premium',
    conversationId?: string,
    followUpMessage?: string,
  ): Promise<{
    estimate: CreditEstimate;
    balance: { total: number; monthly: number; purchased: number };
    isLightFeature: boolean;
  }> {
    const modelConfig = await this.aiTier.getModelConfig(userId, premiumMode, templateSlug, aiMode);

    // Light features are free — return 0
    const isLightFeature = this.aiTier.getCreditCost(templateSlug, false, false) === 0;
    if (isLightFeature) {
      const balance = await this.creditService.getBalance(userId);
      return {
        estimate: {
          credits: 0,
          breakdown: {
            model: modelConfig.model,
            inputChars: 0,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            estimatedApiCostYen: 0,
          },
        },
        balance,
        isLightFeature: true,
      };
    }

    // Build the prompt to measure actual size
    const varsCopy = { ...variables };
    const { prompt, structuralContext } = await this.buildPrompt(templateSlug, varsCopy);

    // For follow-ups, account for conversation history
    let totalPromptChars = prompt.length;
    if (conversationId && followUpMessage) {
      const existing = await this.prisma.aiGenerationHistory.findUnique({
        where: { id: conversationId },
      });
      if (existing) {
        const historyChars = (existing.messages as any[])
          .reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);
        totalPromptChars = historyChars + followUpMessage.length;
      }
    }

    const requestedChars = variables.char_count ? parseInt(variables.char_count, 10) : 1000;
    const baseMaxTokens = Math.max(4000, Math.min(12000, requestedChars * 3));
    const maxOutputTokens = modelConfig.thinking ? 8000 : baseMaxTokens;

    // Determine min credits based on mode
    let minCredits = 1;
    if (aiMode === 'thinking' || (premiumMode && !modelConfig.model.includes('opus'))) minCredits = 2;
    if (aiMode === 'premium' || modelConfig.model.includes('opus')) minCredits = 5;

    const estimate = this.aiTier.estimateCreditCost({
      model: modelConfig.model,
      inputChars: totalPromptChars,
      structuralContextChars: structuralContext?.length || 0,
      maxOutputTokens,
      thinkingBudgetTokens: modelConfig.budgetTokens,
      minCredits,
    });

    const balance = await this.creditService.getBalance(userId);

    return { estimate, balance, isLightFeature: false };
  }

  async *streamAssist(
    userId: string,
    templateSlug: string,
    variables: Record<string, string>,
    premiumMode: boolean = false,
    conversationId?: string,
    followUpMessage?: string,
    episodeId?: string,
    aiMode?: 'normal' | 'thinking' | 'premium',
  ): AsyncGenerator<string> {
    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    if (!this.checkRateLimit(userId)) {
      throw new ServiceUnavailableException('Rate limit exceeded. Please try again later.');
    }

    // Check AI tier and get model config
    const modelConfig = await this.aiTier.getModelConfig(userId, premiumMode, templateSlug, aiMode);

    // Load template for logging metadata
    const template = await this.templates.findBySlug(templateSlug);

    // Build prompt (also injects structural context into variables)
    const { prompt, structuralContext } = await this.buildPrompt(templateSlug, variables);

    // Build messages array: new conversation or follow-up
    let existingConversation: any = null;
    let messages: { role: string; content: string }[];

    if (conversationId && followUpMessage) {
      existingConversation = await this.prisma.aiGenerationHistory.findUnique({
        where: { id: conversationId },
      });
      if (existingConversation && existingConversation.userId === userId) {
        messages = [...(existingConversation.messages as any[]), { role: 'user', content: followUpMessage }];
      } else {
        messages = [{ role: 'user', content: prompt }];
      }
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let fullOutput = '';

    // Scale max_tokens based on requested char_count
    const requestedChars = variables.char_count ? parseInt(variables.char_count, 10) : 1000;
    const baseMaxTokens = Math.max(4000, Math.min(12000, requestedChars * 3));

    // Separate structural context as a cacheable system prompt
    const systemParts: { type: string; text: string; cache_control?: { type: string } }[] = [];
    if (structuralContext) {
      systemParts.push({
        type: 'text',
        text: structuralContext,
        cache_control: { type: 'ephemeral' },
      });
    }

    const requestBody: Record<string, unknown> = {
      model: modelConfig.model,
      max_tokens: modelConfig.thinking ? modelConfig.budgetTokens + 8000 : baseMaxTokens,
      stream: true,
      ...(systemParts.length > 0 ? { system: systemParts } : {}),
      messages,
    };

    if (modelConfig.thinking) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: modelConfig.budgetTokens,
      };
    }

    // Dynamic credit cost based on content size
    const isLightFeature = this.aiTier.getCreditCost(templateSlug, false, false) === 0;
    let creditCost = 0;
    if (!isLightFeature) {
      const totalPromptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
      const maxOutputTokens = modelConfig.thinking ? 8000 : baseMaxTokens;
      let minCredits = 1;
      if (aiMode === 'thinking' || (premiumMode && !modelConfig.model.includes('opus'))) minCredits = 2;
      if (aiMode === 'premium' || modelConfig.model.includes('opus')) minCredits = 5;

      creditCost = this.aiTier.estimateCreditCost({
        model: modelConfig.model,
        inputChars: totalPromptChars,
        structuralContextChars: structuralContext?.length || 0,
        maxOutputTokens,
        thinkingBudgetTokens: modelConfig.budgetTokens,
        minCredits,
      }).credits;
    }

    // Credit consumption: PENDING phase
    let transactionId: string | null = null;
    let contentDelivered = false;

    try {
      if (creditCost > 0) {
        const result = await this.creditService.consumeCredits(
          userId,
          creditCost,
          modelConfig.thinking ? 'writing_assist_premium' : 'writing_assist',
          modelConfig.model,
        );
        transactionId = result.transactionId;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Claude API error: ${response.status} ${errorText}`);
        if (transactionId) {
          await this.creditService.refundTransaction(transactionId);
          transactionId = null;
        }
        throw new ServiceUnavailableException(`AI service error (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        if (transactionId) {
          await this.creditService.refundTransaction(transactionId);
          transactionId = null;
        }
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
                contentDelivered = true;
                fullOutput += event.delta.text;
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

        // Log usage
        const durationMs = Date.now() - startTime;
        await this.prisma.aiUsageLog.create({
          data: {
            userId,
            templateId: template.id,
            feature: modelConfig.thinking ? 'writing_assist_premium' : 'writing_assist',
            inputTokens,
            outputTokens,
            model: modelConfig.model,
            durationMs,
          },
        }).catch((e) => this.logger.error('Failed to log AI usage', e));

        // Save to generation history
        if (contentDelivered && variables.workId) {
          const updatedMessages = [...messages, { role: 'assistant', content: fullOutput }];
          try {
            if (existingConversation) {
              // Update existing conversation
              await this.prisma.aiGenerationHistory.update({
                where: { id: existingConversation.id },
                data: {
                  messages: updatedMessages as any,
                  creditCost: (existingConversation.creditCost || 0) + creditCost,
                  model: modelConfig.model,
                  premiumMode,
                  updatedAt: new Date(),
                },
              });
              // Emit the same conversationId
              yield `\n__CONVERSATION_ID__:${existingConversation.id}`;
            } else {
              // Create new conversation
              const record = await this.prisma.aiGenerationHistory.create({
                data: {
                  userId,
                  workId: variables.workId,
                  episodeId: episodeId || null,
                  templateSlug,
                  promptSummary: (followUpMessage || variables.user_prompt || template.name).slice(0, 200),
                  messages: updatedMessages as any,
                  creditCost,
                  model: modelConfig.model,
                  premiumMode,
                },
              });
              yield `\n__CONVERSATION_ID__:${record.id}`;
            }
          } catch (e) {
            this.logger.error('Failed to save generation history', e);
          }
        }

        // Confirm transaction on successful delivery
        if (transactionId && contentDelivered) {
          await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed: ${transactionId}`, e));
          transactionId = null;
        }
      }
    } catch (error) {
      if (transactionId && !contentDelivered) {
        await this.creditService.refundTransaction(transactionId).catch((e) => this.logger.error(`Credit refund failed: ${transactionId}`, e));
      } else if (transactionId && contentDelivered) {
        await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed: ${transactionId}`, e));
      }
      throw error;
    }
  }

  /** Extract new characters/settings from generated text using Haiku */
  async extractNewCharacters(
    generatedText: string,
    existingCharacters: { name: string; role?: string }[],
  ): Promise<{ characters: { name: string; role: string; gender: string; personality: string; speechStyle: string; description: string }[] }> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) {
      this.logger.error('extractNewCharacters: API key is not configured');
      throw new ServiceUnavailableException('AI APIキーが設定されていません');
    }

    const existingNames = existingCharacters.map((c) => c.name).join('、');
    const prompt = `以下の小説テキストから、新しく登場したキャラクターを抽出してください。

【既存キャラクター（除外してください）】
${existingNames || '（なし）'}

【テキスト】
${generatedText.slice(0, 30000)}

【指示】
- 既存キャラクターに含まれない、新しく登場したキャラクターのみを抽出してください
- 名前のない一般的な通行人やモブキャラクターは除外してください
- 以下のJSON形式で出力してください。新しいキャラクターがいなければ空配列を返してください

{"characters":[{"name":"名前","role":"役割（主人公/ヒロイン/ライバル/脇役など）","gender":"性別","personality":"性格の要約","speechStyle":"口調の特徴（例: 丁寧語、ぶっきらぼう、関西弁）","description":"人物の概要"}]}

JSONのみを出力してください。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`Claude API error ${response.status}: ${errorText}`);
      throw new ServiceUnavailableException(`AI APIエラー (${response.status})`);
    }

    const data = await response.json() as { content: { type: string; text?: string }[] };
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        if (parsed.characters && Array.isArray(parsed.characters)) {
          return { characters: parsed.characters };
        }
      } catch (e) {
        this.logger.error('Failed to parse character extraction response', text);
      }
    }

    return { characters: [] };
  }
}
