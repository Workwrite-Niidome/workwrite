import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
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

  async *streamAssist(
    userId: string,
    templateSlug: string,
    variables: Record<string, string>,
    premiumMode: boolean = false,
  ): AsyncGenerator<string> {
    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    if (!this.checkRateLimit(userId)) {
      throw new ServiceUnavailableException('Rate limit exceeded. Please try again later.');
    }

    const template = await this.templates.findBySlug(templateSlug);

    // Check AI tier and get model config (pass slug for model routing)
    const modelConfig = await this.aiTier.getModelConfig(userId, premiumMode, templateSlug);

    // Calculate credit cost
    const creditCost = this.aiTier.getCreditCost(
      templateSlug,
      premiumMode,
      modelConfig.model.includes('opus'),
    );

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

    // Build prompt from template
    let prompt = template.prompt;

    // Handle conditional sections: {{#key}}...{{/key}} - include block only if variable exists
    for (const [key, value] of Object.entries(variables)) {
      const sectionRegex = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{/${key}\\}\\}`, 'g');
      if (value && value.trim()) {
        // Keep the section content (remove markers)
        prompt = prompt.replace(sectionRegex, '$1');
      } else {
        // Remove entire section
        prompt = prompt.replace(sectionRegex, '');
      }
    }
    // Remove any remaining conditional sections for variables not provided
    prompt = prompt.replace(/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/g, '');

    // Replace variable placeholders
    for (const [key, value] of Object.entries(variables)) {
      const truncated = key === 'content' ? value.slice(0, MAX_CONTENT_LENGTH) : value.slice(0, MAX_CONTENT_LENGTH);
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), truncated);
    }

    // Append custom instruction if provided
    if (variables.custom_instruction) {
      prompt += `\n\n【著者からの追加指示】\n${variables.custom_instruction}`;
    }

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    // Scale max_tokens based on requested char_count (Japanese ~2 tokens/char)
    const requestedChars = variables.char_count ? parseInt(variables.char_count, 10) : 1000;
    const baseMaxTokens = Math.max(4000, Math.min(12000, requestedChars * 3));

    // Separate structural context as a cacheable system prompt
    const systemParts: { type: string; text: string; cache_control?: { type: string } }[] = [];
    if (variables.structural_context) {
      systemParts.push({
        type: 'text',
        text: variables.structural_context,
        cache_control: { type: 'ephemeral' },
      });
    }

    // Build request body with optional extended thinking
    const requestBody: Record<string, unknown> = {
      model: modelConfig.model,
      max_tokens: modelConfig.thinking ? modelConfig.budgetTokens + 8000 : baseMaxTokens,
      stream: true,
      ...(systemParts.length > 0 ? { system: systemParts } : {}),
      messages: [{ role: 'user', content: prompt }],
    };

    if (modelConfig.thinking) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: modelConfig.budgetTokens,
      };
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
        // Refund on API error (no content delivered)
        if (transactionId) {
          await this.creditService.refundTransaction(transactionId);
          transactionId = null; // Prevent double refund in catch
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

        // Confirm transaction on successful delivery
        if (transactionId && contentDelivered) {
          await this.creditService.confirmTransaction(transactionId).catch(() => {});
          transactionId = null; // prevent double-confirm in catch
        }
      }
    } catch (error) {
      // Refund if no content was delivered
      if (transactionId && !contentDelivered) {
        await this.creditService.refundTransaction(transactionId).catch(() => {});
      } else if (transactionId && contentDelivered) {
        await this.creditService.confirmTransaction(transactionId).catch(() => {});
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
