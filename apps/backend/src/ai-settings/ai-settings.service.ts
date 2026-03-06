import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { encrypt, decrypt } from '../common/crypto.util';

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getSetting(key: string): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return null;
    if (setting.encrypted) {
      try {
        return decrypt(setting.value);
      } catch (e) {
        this.logger.error(`Failed to decrypt setting: ${key}`, e);
        return null;
      }
    }
    return setting.value;
  }

  async setSetting(key: string, value: string, encrypted: boolean, adminId?: string): Promise<void> {
    const storedValue = encrypted ? encrypt(value) : value;
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value: storedValue, encrypted, updatedBy: adminId },
      create: { key, value: storedValue, encrypted, updatedBy: adminId },
    });
  }

  async getAllSettings(): Promise<{ key: string; value: string; encrypted: boolean; updatedAt: Date }[]> {
    const settings = await this.prisma.systemSetting.findMany();
    return settings.map((s) => ({
      key: s.key,
      value: s.encrypted ? '••••••••' : s.value,
      encrypted: s.encrypted,
      updatedAt: s.updatedAt,
    }));
  }

  async getApiKey(): Promise<string | null> {
    const dbKey = await this.getSetting('ai.api_key');
    if (dbKey) return dbKey;
    return this.config.get<string>('CLAUDE_API_KEY') || null;
  }

  async isAiEnabled(): Promise<boolean> {
    const enabled = await this.getSetting('ai.enabled');
    if (enabled !== null) return enabled === 'true';
    // Default: enabled if API key is available
    const apiKey = await this.getApiKey();
    return !!apiKey;
  }

  async getModel(): Promise<string> {
    const model = await this.getSetting('ai.model');
    return model || 'claude-sonnet-4-6';
  }

  async getUsageStats(): Promise<{ totalRequests: number; totalInputTokens: number; totalOutputTokens: number }> {
    const result = await this.prisma.aiUsageLog.aggregate({
      _count: { id: true },
      _sum: { inputTokens: true, outputTokens: true },
    });
    return {
      totalRequests: result._count.id,
      totalInputTokens: result._sum.inputTokens || 0,
      totalOutputTokens: result._sum.outputTokens || 0,
    };
  }

  async getDailyUsage(days = 30): Promise<{ date: string; requests: number; tokens: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, inputTokens: true, outputTokens: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap = new Map<string, { requests: number; tokens: number }>();
    for (const log of logs) {
      const date = log.createdAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(date) || { requests: 0, tokens: 0 };
      existing.requests++;
      existing.tokens += log.inputTokens + log.outputTokens;
      dailyMap.set(date, existing);
    }

    return Array.from(dailyMap.entries()).map(([date, stats]) => ({ date, ...stats }));
  }
}
