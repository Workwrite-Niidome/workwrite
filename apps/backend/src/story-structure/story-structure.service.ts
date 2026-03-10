import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateCharacterDto, UpdateCharacterDto, SetRelationDto,
  UpsertArcDto, CreateSceneDto, UpdateSceneDto,
} from './dto/story-structure.dto';

@Injectable()
export class StoryStructureService {
  constructor(private prisma: PrismaService) {}

  // ─── Characters ──────────────────────────────────────

  async getCharacters(workId: string) {
    return this.prisma.storyCharacter.findMany({
      where: { workId },
      include: {
        relationsFrom: { include: { to: { select: { id: true, name: true } } } },
        relationsTo: { include: { from: { select: { id: true, name: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPublicCharacters(workId: string) {
    return this.prisma.storyCharacter.findMany({
      where: { workId, isPublic: true },
      include: {
        relationsFrom: {
          include: { to: { select: { id: true, name: true, isPublic: true } } },
        },
        relationsTo: {
          include: { from: { select: { id: true, name: true, isPublic: true } } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCharacter(workId: string, dto: CreateCharacterDto) {
    const maxOrder = await this.prisma.storyCharacter.aggregate({
      where: { workId },
      _max: { sortOrder: true },
    });
    return this.prisma.storyCharacter.create({
      data: {
        workId,
        ...dto,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateCharacter(workId: string, id: string, dto: UpdateCharacterDto) {
    const char = await this.prisma.storyCharacter.findUnique({ where: { id } });
    if (!char || char.workId !== workId) throw new NotFoundException();
    return this.prisma.storyCharacter.update({ where: { id }, data: dto });
  }

  async deleteCharacter(workId: string, id: string) {
    const char = await this.prisma.storyCharacter.findUnique({ where: { id } });
    if (!char || char.workId !== workId) throw new NotFoundException();
    await this.prisma.storyCharacter.delete({ where: { id } });
    return { deleted: true };
  }

  async setRelation(workId: string, fromId: string, dto: SetRelationDto) {
    const from = await this.prisma.storyCharacter.findUnique({ where: { id: fromId } });
    if (!from || from.workId !== workId) throw new NotFoundException();
    const to = await this.prisma.storyCharacter.findUnique({ where: { id: dto.toCharacterId } });
    if (!to || to.workId !== workId) throw new NotFoundException();

    return this.prisma.storyCharacterRelation.upsert({
      where: { fromCharacterId_toCharacterId: { fromCharacterId: fromId, toCharacterId: dto.toCharacterId } },
      update: { relationType: dto.relationType, description: dto.description },
      create: {
        fromCharacterId: fromId,
        toCharacterId: dto.toCharacterId,
        relationType: dto.relationType,
        description: dto.description,
      },
    });
  }

  async deleteRelation(workId: string, fromId: string, toId: string) {
    const from = await this.prisma.storyCharacter.findUnique({ where: { id: fromId } });
    if (!from || from.workId !== workId) throw new NotFoundException();
    await this.prisma.storyCharacterRelation.deleteMany({
      where: { fromCharacterId: fromId, toCharacterId: toId },
    });
    return { deleted: true };
  }

  /** Migrate characters from WorkCreationPlan JSON to StoryCharacter table */
  async migrateCharacters(workId: string) {
    const plan = await this.prisma.workCreationPlan.findUnique({ where: { workId } });
    if (!plan?.characters) return { migrated: 0 };

    const chars = plan.characters as any[];
    let migrated = 0;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const existing = await this.prisma.storyCharacter.findFirst({
        where: { workId, name: c.name },
      });
      if (existing) continue;

      await this.prisma.storyCharacter.create({
        data: {
          workId,
          name: c.name || '名前未設定',
          role: c.role || '不明',
          gender: c.gender,
          age: c.age,
          firstPerson: c.firstPerson,
          personality: c.personality,
          speechStyle: c.speechStyle,
          appearance: c.appearance,
          background: c.background,
          motivation: c.motivation,
          notes: c.description || c.uniqueTrait,
          sortOrder: i,
        },
      });
      migrated++;
    }
    return { migrated };
  }

  // ─── Story Arc ──────────────────────────────────────

  async getStoryArc(workId: string) {
    return this.prisma.storyArc.findUnique({
      where: { workId },
      include: {
        acts: {
          include: { scenes: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async upsertArc(workId: string, dto: UpsertArcDto) {
    const existing = await this.prisma.storyArc.findUnique({ where: { workId } });

    if (existing) {
      const arc = await this.prisma.storyArc.update({
        where: { workId },
        data: {
          premise: dto.premise,
          centralConflict: dto.centralConflict,
          themes: dto.themes,
        },
      });

      if (dto.acts) {
        for (const actInput of dto.acts) {
          await this.prisma.storyAct.upsert({
            where: { id: `${arc.id}_act${actInput.actNumber}` },
            update: { title: actInput.title, summary: actInput.summary, turningPoint: actInput.turningPoint },
            create: {
              id: `${arc.id}_act${actInput.actNumber}`,
              arcId: arc.id,
              actNumber: actInput.actNumber,
              title: actInput.title,
              summary: actInput.summary,
              turningPoint: actInput.turningPoint,
              sortOrder: actInput.actNumber,
            },
          });
        }
      }

      return this.getStoryArc(workId);
    }

    const arc = await this.prisma.storyArc.create({
      data: {
        workId,
        premise: dto.premise,
        centralConflict: dto.centralConflict,
        themes: dto.themes || [],
      },
    });

    if (dto.acts) {
      for (const actInput of dto.acts) {
        await this.prisma.storyAct.create({
          data: {
            id: `${arc.id}_act${actInput.actNumber}`,
            arcId: arc.id,
            actNumber: actInput.actNumber,
            title: actInput.title,
            summary: actInput.summary,
            turningPoint: actInput.turningPoint,
            sortOrder: actInput.actNumber,
          },
        });
      }
    }

    return this.getStoryArc(workId);
  }

  async createScene(workId: string, dto: CreateSceneDto) {
    const act = await this.prisma.storyAct.findUnique({
      where: { id: dto.actId },
      include: { arc: true },
    });
    if (!act || act.arc.workId !== workId) throw new NotFoundException();

    const maxOrder = await this.prisma.storyScene.aggregate({
      where: { actId: dto.actId },
      _max: { sortOrder: true },
    });

    return this.prisma.storyScene.create({
      data: {
        actId: dto.actId,
        title: dto.title,
        summary: dto.summary,
        emotionTarget: dto.emotionTarget,
        intensity: dto.intensity,
        characters: dto.characters || [],
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateScene(workId: string, sceneId: string, dto: UpdateSceneDto) {
    const scene = await this.prisma.storyScene.findUnique({
      where: { id: sceneId },
      include: { act: { include: { arc: true } } },
    });
    if (!scene || scene.act.arc.workId !== workId) throw new NotFoundException();

    return this.prisma.storyScene.update({
      where: { id: sceneId },
      data: {
        title: dto.title,
        summary: dto.summary,
        emotionTarget: dto.emotionTarget,
        intensity: dto.intensity,
        characters: dto.characters,
        status: dto.status,
        episodeId: dto.episodeId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deleteScene(workId: string, sceneId: string) {
    const scene = await this.prisma.storyScene.findUnique({
      where: { id: sceneId },
      include: { act: { include: { arc: true } } },
    });
    if (!scene || scene.act.arc.workId !== workId) throw new NotFoundException();
    await this.prisma.storyScene.delete({ where: { id: sceneId } });
    return { deleted: true };
  }

  async linkSceneToEpisode(workId: string, sceneId: string, episodeId: string) {
    const scene = await this.prisma.storyScene.findUnique({
      where: { id: sceneId },
      include: { act: { include: { arc: true } } },
    });
    if (!scene || scene.act.arc.workId !== workId) throw new NotFoundException();

    return this.prisma.storyScene.update({
      where: { id: sceneId },
      data: { episodeId, status: 'done' },
    });
  }

  /** Migrate plotOutline + chapterOutline from WorkCreationPlan to StoryArc/Act/Scene */
  async migrateArc(workId: string) {
    const plan = await this.prisma.workCreationPlan.findUnique({ where: { workId } });
    if (!plan) return { migrated: false };

    const existing = await this.prisma.storyArc.findUnique({ where: { workId } });
    if (existing) return { migrated: false, reason: 'arc already exists' };

    const plot = plan.plotOutline as any;
    const chapters = (plan.chapterOutline || []) as any[];

    // Create arc from plot outline
    const arc = await this.prisma.storyArc.create({
      data: {
        workId,
        premise: typeof plot === 'string' ? plot : plot?.premise || plot?.text || '',
        centralConflict: plot?.centralConflict || '',
        themes: plot?.themes || [],
      },
    });

    // Create 3 acts
    const actTitles = ['序章（起）', '展開（承転）', '結末（結）'];
    if (plot?.threeActStructure) {
      const tas = plot.threeActStructure;
      for (const [key, idx] of [['act1', 0], ['act2', 1], ['act3', 2]] as const) {
        const act = tas[key];
        if (act) {
          actTitles[idx as number] = act.title || actTitles[idx as number];
        }
      }
    }

    const acts = [];
    for (let i = 0; i < 3; i++) {
      const act = await this.prisma.storyAct.create({
        data: {
          id: `${arc.id}_act${i + 1}`,
          arcId: arc.id,
          actNumber: i + 1,
          title: actTitles[i],
          sortOrder: i + 1,
        },
      });
      acts.push(act);
    }

    // Distribute chapters as scenes across 3 acts
    if (chapters.length > 0) {
      const perAct = Math.ceil(chapters.length / 3);
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const actIdx = Math.min(Math.floor(i / perAct), 2);
        await this.prisma.storyScene.create({
          data: {
            actId: acts[actIdx].id,
            title: ch.title || `シーン${i + 1}`,
            summary: ch.summary,
            emotionTarget: ch.emotionTarget,
            characters: [],
            sortOrder: i,
          },
        });
      }
    }

    return { migrated: true };
  }

  // ─── For AI Context ─────────────────────────────────

  /** Build a rich context string from structured character + arc data */
  async buildStructuredContext(workId: string): Promise<string | null> {
    const characters = await this.prisma.storyCharacter.findMany({
      where: { workId },
      include: {
        relationsFrom: { include: { to: { select: { name: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const arc = await this.getStoryArc(workId);

    if (characters.length === 0 && !arc) return null;

    const parts: string[] = [];

    if (characters.length > 0) {
      const sheets = characters.map((c) => {
        const lines = [`■ ${c.name}（${c.role}）`];
        if (c.gender) lines.push(`  性別: ${c.gender}`);
        if (c.age) lines.push(`  年齢: ${c.age}`);
        if (c.firstPerson) lines.push(`  一人称: ${c.firstPerson}`);
        if (c.personality) lines.push(`  性格: ${c.personality}`);
        if (c.speechStyle) lines.push(`  口調: ${c.speechStyle}`);
        if (c.appearance) lines.push(`  外見: ${c.appearance}`);
        if (c.background) lines.push(`  背景: ${c.background}`);
        if (c.motivation) lines.push(`  動機: ${c.motivation}`);
        if (c.arc) lines.push(`  成長アーク: ${c.arc}`);
        if (c.relationsFrom.length > 0) {
          const rels = c.relationsFrom.map((r) => `${r.to.name}（${r.relationType}）`).join('、');
          lines.push(`  関係: ${rels}`);
        }
        return lines.join('\n');
      }).join('\n\n');
      parts.push(`【登場キャラクター設定（厳守）】\n${sheets}`);
    }

    if (arc) {
      const arcLines: string[] = [];
      if (arc.premise) arcLines.push(`前提: ${arc.premise}`);
      if (arc.centralConflict) arcLines.push(`中心的葛藤: ${arc.centralConflict}`);
      if (arc.themes.length > 0) arcLines.push(`テーマ: ${arc.themes.join('、')}`);

      for (const act of arc.acts) {
        arcLines.push(`\n【第${act.actNumber}幕: ${act.title}】`);
        if (act.summary) arcLines.push(`  概要: ${act.summary}`);
        if (act.turningPoint) arcLines.push(`  転換点: ${act.turningPoint}`);
        for (const scene of act.scenes) {
          const statusMark = scene.status === 'done' ? '✓' : scene.status === 'writing' ? '▸' : '○';
          arcLines.push(`  ${statusMark} ${scene.title}${scene.emotionTarget ? ` [${scene.emotionTarget}]` : ''}`);
        }
      }
      parts.push(`【物語構造】\n${arcLines.join('\n')}`);
    }

    return parts.join('\n\n');
  }
}
