import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MODERATION_PROMPT = `あなたはファンレターの内容審査AIです。
以下のファンレターが送信可能か判定してください。

【拒否基準】
- 攻撃的・侮辱的な表現、誹謗中傷
- 個人情報の要求・暴露
- スパム・宣伝・URL
- 性的に露骨な内容
- 脅迫・嫌がらせ

【許可する内容】
- 作品への感想（ネタバレ含む）
- 作者への応援・励まし
- 建設的な意見・感想
- 絵文字や感嘆表現

レター内容:
"""
{content}
"""

JSON形式で回答してください（他の文字は含めないでください）:
{"approved": true}
または
{"approved": false, "reason": "拒否理由"}`;

export interface ModerationResult {
  approved: boolean;
  reason?: string;
}

@Injectable()
export class LetterModerationService {
  private readonly logger = new Logger(LetterModerationService.name);

  constructor(private config: ConfigService) {}

  async moderate(content: string): Promise<ModerationResult> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set, auto-approving letter');
      return { approved: true };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [
            { role: 'user', content: MODERATION_PROMPT.replace('{content}', content) },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.error(`Moderation API error: ${response.status}`);
        return { approved: true };
      }

      const data = await response.json();
      const text = data.content?.[0]?.text ?? '';
      const json = JSON.parse(text.trim());
      return {
        approved: !!json.approved,
        reason: json.reason || undefined,
      };
    } catch (err) {
      this.logger.error('Letter moderation failed, auto-approving', err);
      return { approved: true };
    }
  }
}
