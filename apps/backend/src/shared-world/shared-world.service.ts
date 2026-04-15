import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SharedWorldService {
  constructor(private prisma: PrismaService) {}

  /**
   * SharedWorldを作成し、原典WorkをORIGINとして登録する
   */
  async createSharedWorld(
    ownerId: string,
    canonWorkId: string,
    name: string,
    description?: string,
  ) {
    // 作品の存在確認
    const work = await this.prisma.work.findUnique({
      where: { id: canonWorkId },
      select: { id: true, authorId: true, enableWorldFragments: true },
    });
    if (!work) {
      throw new NotFoundException('Work not found');
    }
    if (!work.enableWorldFragments) {
      throw new BadRequestException('Work must have enableWorldFragments=true');
    }

    // WorldCanonの存在確認
    const canon = await this.prisma.worldCanon.findUnique({
      where: { workId: canonWorkId },
    });
    if (!canon) {
      throw new BadRequestException('Work must have a WorldCanon built before creating a SharedWorld');
    }

    // 既にSharedWorldに所属していないか確認
    const existingLink = await this.prisma.sharedWorldWork.findUnique({
      where: { workId: canonWorkId },
    });
    if (existingLink) {
      throw new BadRequestException('This work already belongs to a SharedWorld');
    }

    // SharedWorld + ORIGIN SharedWorldWork をトランザクションで作成
    const sharedWorld = await this.prisma.$transaction(async (tx) => {
      const sw = await tx.sharedWorld.create({
        data: {
          name,
          description,
          ownerId,
          canonWorkId,
        },
      });

      await tx.sharedWorldWork.create({
        data: {
          sharedWorldId: sw.id,
          workId: canonWorkId,
          role: 'ORIGIN',
        },
      });

      return tx.sharedWorld.findUnique({
        where: { id: sw.id },
        include: {
          works: true,
        },
      });
    });

    return sharedWorld;
  }

  /**
   * 派生作品を追加する。新しいWorkを作成し、SharedWorldWorkとしてリンクする
   */
  async addDerivativeWork(
    sharedWorldId: string,
    userId: string,
    workData: { title: string; synopsis?: string; genre?: string },
  ) {
    const sharedWorld = await this.prisma.sharedWorld.findUnique({
      where: { id: sharedWorldId },
    });
    if (!sharedWorld) {
      throw new NotFoundException('SharedWorld not found');
    }
    // オーナーまたは承認済みメンバーのみ
    if (sharedWorld.ownerId !== userId) {
      const member = await this.prisma.sharedWorldMember.findUnique({
        where: { sharedWorldId_userId: { sharedWorldId, userId } },
      });
      if (!member || member.status !== 'ACCEPTED') {
        throw new ForbiddenException('Only the owner or accepted members can add derivative works');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 新しいWorkを作成
      const newWork = await tx.work.create({
        data: {
          authorId: userId,
          title: workData.title,
          synopsis: workData.synopsis,
          genre: workData.genre,
          enableWorldFragments: true,
        },
      });

      // SharedWorldWorkとしてリンク
      await tx.sharedWorldWork.create({
        data: {
          sharedWorldId,
          workId: newWork.id,
          role: 'DERIVATIVE',
        },
      });

      return newWork;
    });

    return result;
  }

  /**
   * SharedWorldを取得（全works含む）
   */
  async getSharedWorld(id: string) {
    const sharedWorld = await this.prisma.sharedWorld.findUnique({
      where: { id },
      include: {
        works: {
          include: {
            // workIdからWorkの情報を取得するために別途クエリが必要
          },
        },
      },
    });
    if (!sharedWorld) {
      throw new NotFoundException('SharedWorld not found');
    }

    // 各workの詳細を取得
    const workIds = sharedWorld.works.map((w) => w.workId);
    const works = await this.prisma.work.findMany({
      where: { id: { in: workIds } },
      select: {
        id: true,
        title: true,
        synopsis: true,
        coverUrl: true,
        genre: true,
      },
    });
    const workMap = new Map(works.map((w) => [w.id, w]));

    return {
      ...sharedWorld,
      works: sharedWorld.works.map((sw) => ({
        ...sw,
        work: workMap.get(sw.workId) ?? null,
      })),
    };
  }

  /**
   * workIdからSharedWorldを検索する
   */
  async getSharedWorldByWork(workId: string) {
    const link = await this.prisma.sharedWorldWork.findUnique({
      where: { workId },
      include: {
        sharedWorld: {
          include: {
            works: true,
          },
        },
      },
    });
    if (!link) return null;
    return link.sharedWorld;
  }

  /**
   * 派生作品がSharedWorldに所属している場合、原典作品のWorldCanonを返す
   * 他のサービスが利用するキーメソッド
   */
  async getCanonForWork(workId: string) {
    const link = await this.prisma.sharedWorldWork.findUnique({
      where: { workId },
    });
    if (!link || link.role !== 'DERIVATIVE') return null;

    const sharedWorld = await this.prisma.sharedWorld.findUnique({
      where: { id: link.sharedWorldId },
    });
    if (!sharedWorld) return null;

    const canon = await this.prisma.worldCanon.findUnique({
      where: { workId: sharedWorld.canonWorkId },
    });

    return canon;
  }

  /**
   * 作者を共有世界に招待する（オーナーのみ）
   */
  async inviteMember(sharedWorldId: string, ownerId: string, inviteeUserId: string) {
    const sharedWorld = await this.prisma.sharedWorld.findUnique({
      where: { id: sharedWorldId },
    });
    if (!sharedWorld) throw new NotFoundException('SharedWorld not found');
    if (sharedWorld.ownerId !== ownerId) throw new ForbiddenException('Only the owner can invite members');
    if (sharedWorld.ownerId === inviteeUserId) throw new BadRequestException('Cannot invite yourself');

    const existing = await this.prisma.sharedWorldMember.findUnique({
      where: { sharedWorldId_userId: { sharedWorldId, userId: inviteeUserId } },
    });
    if (existing) throw new BadRequestException('User is already invited or a member');

    return this.prisma.sharedWorldMember.create({
      data: {
        sharedWorldId,
        userId: inviteeUserId,
        status: 'INVITED',
      },
    });
  }

  /**
   * 招待に応答する（招待された作者が承諾/辞退）
   */
  async respondToInvitation(sharedWorldId: string, userId: string, accept: boolean) {
    const member = await this.prisma.sharedWorldMember.findUnique({
      where: { sharedWorldId_userId: { sharedWorldId, userId } },
    });
    if (!member) throw new NotFoundException('Invitation not found');
    if (member.status !== 'INVITED') throw new BadRequestException('Invitation already responded to');

    return this.prisma.sharedWorldMember.update({
      where: { id: member.id },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date(),
      },
    });
  }

  /**
   * 共有世界のメンバー一覧
   */
  async getMembers(sharedWorldId: string) {
    const members = await this.prisma.sharedWorldMember.findMany({
      where: { sharedWorldId },
      orderBy: { invitedAt: 'asc' },
    });

    // ユーザー情報を取得
    const userIds = members.map((m) => m.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, displayName: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return members.map((m) => ({
      ...m,
      user: userMap.get(m.userId) ?? null,
    }));
  }

  /**
   * 自分が招待されている共有世界の一覧
   */
  async listInvitations(userId: string) {
    return this.prisma.sharedWorldMember.findMany({
      where: { userId, status: 'INVITED' },
      include: { sharedWorld: true },
      orderBy: { invitedAt: 'desc' },
    });
  }

  /**
   * オーナーの全SharedWorldを取得
   */
  async listByOwner(ownerId: string) {
    const worlds = await this.prisma.sharedWorld.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        works: true,
      },
    });

    return worlds;
  }
}
