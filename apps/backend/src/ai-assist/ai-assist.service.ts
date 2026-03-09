import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
import { PromptTemplatesService } from '../prompt-templates/prompt-templates.service';

const MAX_CONTENT_LENGTH = 10000;

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
  ) {}

  async checkStatus(userId?: string): Promise<{
    available: boolean;
    model: string;
    tier?: { plan: string; canUseAi: boolean; canUseThinking: boolean; remainingFreeUses: number | null };
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

    // Check AI tier and get model config
    const modelConfig = await this.aiTier.getModelConfig(userId, premiumMode);

    const template = await this.templates.findBySlug(templateSlug);

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

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    // Build request body with optional extended thinking
    const requestBody: Record<string, unknown> = {
      model: modelConfig.model,
      max_tokens: modelConfig.thinking ? 16000 : 4000,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    };

    if (modelConfig.thinking) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: modelConfig.budgetTokens,
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Claude API error: ${response.status} ${errorText}`);
      throw new ServiceUnavailableException('AI service error');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new ServiceUnavailableException('No response stream');

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
    }
  }
}
