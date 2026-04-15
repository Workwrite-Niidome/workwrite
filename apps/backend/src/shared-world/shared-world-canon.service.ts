import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SharedWorldCanonService {
  private readonly logger = new Logger(SharedWorldCanonService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 派生作品の新キャラクターと世界設定をorigin Canonに追加する
   * 追加のみ（上書きなし）。sourceWorkIdタグ付きで追加されるため、後から除去可能
   */
  async contributeToCanon(derivativeWorkId: string) {
    // 派生作品がSharedWorldに所属しているか確認
    const link = await this.prisma.sharedWorldWork.findUnique({
      where: { workId: derivativeWorkId },
    });
    if (!link || link.role !== 'DERIVATIVE') return;

    const sharedWorld = await this.prisma.sharedWorld.findUnique({
      where: { id: link.sharedWorldId },
    });
    if (!sharedWorld) return;

    // origin Canonを取得
    const canon = await this.prisma.worldCanon.findUnique({
      where: { workId: sharedWorld.canonWorkId },
    });
    if (!canon) return;

    // 派生作品のStoryCharacterを取得
    const derivativeChars = await this.prisma.storyCharacter.findMany({
      where: { workId: derivativeWorkId },
      select: {
        id: true,
        name: true,
        role: true,
        personality: true,
        speechStyle: true,
        firstPerson: true,
        motivation: true,
        background: true,
      },
    });

    // origin Canonのキャラクタープロファイルに存在しないキャラを追加
    const existingProfiles = (canon.characterProfiles as any[]) || [];
    const existingNames = new Set(existingProfiles.map((p: any) => p.name));

    const newProfiles = derivativeChars
      .filter((c) => !existingNames.has(c.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role || '',
        personality: c.personality || '',
        speechStyle: c.speechStyle || '',
        motivation: c.motivation || '',
        background: c.background || '',
        constraints: '',
        sourceWorkId: derivativeWorkId, // 追加元を記録
      }));

    // 派生作品のWorldSettingを取得
    const derivativeSettings = await this.prisma.worldSetting.findMany({
      where: { workId: derivativeWorkId },
    });

    // origin CanonのworldRulesに存在しない設定を追加
    const existingRules = (canon.worldRules as any) || {};
    const newRuleEntries: string[] = [];
    for (const ws of derivativeSettings) {
      const key = ws.category || 'other';
      const existing = existingRules[key] || '';
      const detail = `${ws.name}: ${ws.description}`;
      if (!existing.includes(ws.name)) {
        newRuleEntries.push(`[${key}] ${detail}`);
      }
    }

    if (newProfiles.length === 0 && newRuleEntries.length === 0) {
      this.logger.log(`No new contributions from derivative work ${derivativeWorkId}`);
      return;
    }

    // Canon更新（追加のみ）
    const updatedProfiles = [...existingProfiles, ...newProfiles];

    // worldRulesに派生作品の設定を補記
    const updatedRules = { ...existingRules };
    if (newRuleEntries.length > 0) {
      const additions = newRuleEntries.join('\n');
      updatedRules.derivatives = (updatedRules.derivatives || '') +
        (updatedRules.derivatives ? '\n' : '') +
        `[${derivativeWorkId}] ${additions}`;
    }

    await this.prisma.worldCanon.update({
      where: { workId: sharedWorld.canonWorkId },
      data: {
        characterProfiles: updatedProfiles,
        worldRules: updatedRules,
        canonVersion: canon.canonVersion + 1,
      },
    });

    this.logger.log(
      `Contributed ${newProfiles.length} characters and ${newRuleEntries.length} world rules from derivative ${derivativeWorkId} to Canon (v${canon.canonVersion + 1})`,
    );
  }

  /**
   * 派生作品がSharedWorldから除外された場合、その作品の貢献を除去する
   */
  async removeContributions(derivativeWorkId: string, canonWorkId: string) {
    const canon = await this.prisma.worldCanon.findUnique({
      where: { workId: canonWorkId },
    });
    if (!canon) return;

    const profiles = (canon.characterProfiles as any[]) || [];
    const filteredProfiles = profiles.filter(
      (p: any) => p.sourceWorkId !== derivativeWorkId,
    );

    const rules = (canon.worldRules as any) || {};
    const updatedRules = { ...rules };
    if (updatedRules.derivatives) {
      updatedRules.derivatives = updatedRules.derivatives
        .split('\n')
        .filter((line: string) => !line.startsWith(`[${derivativeWorkId}]`))
        .join('\n');
    }

    await this.prisma.worldCanon.update({
      where: { workId: canonWorkId },
      data: {
        characterProfiles: filteredProfiles,
        worldRules: updatedRules,
        canonVersion: canon.canonVersion + 1,
      },
    });

    this.logger.log(`Removed contributions from ${derivativeWorkId} from Canon`);
  }
}
