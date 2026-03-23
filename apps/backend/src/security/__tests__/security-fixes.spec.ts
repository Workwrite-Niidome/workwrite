/**
 * Security Fixes Test Suite
 *
 * Covers ownership enforcement added to:
 * - StoryStructureService: verifyOwnership guard on all write methods
 * - EpisodesService: getSnapshots / getSnapshotContent ownership check
 * - WorkImportService: getImportStatus userId ownership check
 * - CreateTipDto: @IsInt @Min(100) @Max(100000) validation
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StoryStructureService } from '../../story-structure/story-structure.service';
import { EpisodesService } from '../../episodes/episodes.service';
import { WorkImportService } from '../../work-import/work-import.service';
import { CreateTipDto } from '../../payments/dto/create-tip.dto';

// ---------------------------------------------------------------------------
// Shared mock builders
// ---------------------------------------------------------------------------

/** Build a minimal PrismaService mock. Individual tests override methods as needed. */
function buildPrismaMock() {
  return {
    work: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    storyCharacter: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
    },
    storyCharacterRelation: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    storyArc: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    storyAct: {
      upsert: jest.fn(),
      create: jest.fn(),
    },
    storyScene: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
    },
    workCreationPlan: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    episode: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    episodeSnapshot: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    workImport: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as any;
}

// ---------------------------------------------------------------------------
// 1–5  StoryStructureService — ownership on write methods
// ---------------------------------------------------------------------------

describe('StoryStructureService — ownership enforcement', () => {
  const OWNER_ID = 'user-owner';
  const OTHER_ID = 'user-other';
  const WORK_ID = 'work-1';
  const CHAR_ID = 'char-1';

  let service: StoryStructureService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new StoryStructureService(prisma);
  });

  // Helper: make prisma.work.findUnique return a work owned by OWNER_ID
  const mockWorkOwner = (authorId: string) => {
    prisma.work.findUnique.mockResolvedValue({ id: WORK_ID, authorId });
  };

  // ── Test 1 ────────────────────────────────────────────────────────────────
  it('1. createCharacter throws ForbiddenException when user does not own the work', async () => {
    mockWorkOwner(OWNER_ID);

    await expect(
      service.createCharacter(WORK_ID, OTHER_ID, { name: 'Alice', role: 'hero' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  it('2. createCharacter succeeds when user owns the work', async () => {
    mockWorkOwner(OWNER_ID);
    const created = { id: CHAR_ID, name: 'Alice', workId: WORK_ID };
    prisma.storyCharacter.create.mockResolvedValue(created);

    const result = await service.createCharacter(WORK_ID, OWNER_ID, { name: 'Alice', role: 'hero' } as any);

    expect(result).toEqual(created);
    expect(prisma.storyCharacter.create).toHaveBeenCalledTimes(1);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  it('3. updateCharacter throws ForbiddenException for non-owner', async () => {
    mockWorkOwner(OWNER_ID);

    await expect(
      service.updateCharacter(WORK_ID, CHAR_ID, OTHER_ID, { name: 'Bob' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  it('4. deleteCharacter throws ForbiddenException for non-owner', async () => {
    mockWorkOwner(OWNER_ID);

    await expect(
      service.deleteCharacter(WORK_ID, CHAR_ID, OTHER_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────
  it('5. updatePublicFlags throws ForbiddenException for non-owner', async () => {
    mockWorkOwner(OWNER_ID);

    await expect(
      service.updatePublicFlags(WORK_ID, OTHER_ID, { isWorldPublic: true }),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Extra: verifyOwnership throws NotFoundException when work is missing ──
  it('verifyOwnership throws NotFoundException when work does not exist', async () => {
    prisma.work.findUnique.mockResolvedValue(null);

    await expect(
      service.createCharacter(WORK_ID, OWNER_ID, { name: 'X', role: 'y' } as any),
    ).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// 6–8  EpisodesService — snapshot ownership
// ---------------------------------------------------------------------------

describe('EpisodesService — snapshot ownership', () => {
  const OWNER_ID = 'user-owner';
  const OTHER_ID = 'user-other';
  const EPISODE_ID = 'ep-1';
  const SNAPSHOT_ID = 'snap-1';

  let service: EpisodesService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new EpisodesService(prisma);
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────
  it('6. getSnapshots throws ForbiddenException when user does not own the episode work', async () => {
    prisma.episode.findUnique.mockResolvedValue({
      id: EPISODE_ID,
      work: { authorId: OWNER_ID },
    });

    await expect(service.getSnapshots(EPISODE_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
  });

  // ── Test 7 ────────────────────────────────────────────────────────────────
  it('7. getSnapshots succeeds for the work author', async () => {
    prisma.episode.findUnique.mockResolvedValue({
      id: EPISODE_ID,
      work: { authorId: OWNER_ID },
    });
    const snapshots = [{ id: SNAPSHOT_ID, title: 'ep', wordCount: 100, label: null, createdAt: new Date() }];
    prisma.episodeSnapshot.findMany.mockResolvedValue(snapshots);

    const result = await service.getSnapshots(EPISODE_ID, OWNER_ID);

    expect(result).toEqual(snapshots);
    expect(prisma.episodeSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { episodeId: EPISODE_ID } }),
    );
  });

  // ── Test 8 ────────────────────────────────────────────────────────────────
  it('8. getSnapshotContent throws ForbiddenException for non-owner', async () => {
    prisma.episodeSnapshot.findUnique.mockResolvedValue({
      id: SNAPSHOT_ID,
      episodeId: EPISODE_ID,
      content: 'secret',
    });
    prisma.episode.findUnique.mockResolvedValue({
      id: EPISODE_ID,
      work: { authorId: OWNER_ID },
    });

    await expect(service.getSnapshotContent(SNAPSHOT_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
  });

  // ── Extra: getSnapshots throws NotFoundException for missing episode ───────
  it('getSnapshots throws NotFoundException when episode does not exist', async () => {
    prisma.episode.findUnique.mockResolvedValue(null);

    await expect(service.getSnapshots(EPISODE_ID, OWNER_ID)).rejects.toThrow(NotFoundException);
  });

  // ── Extra: getSnapshotContent throws NotFoundException for missing snapshot ─
  it('getSnapshotContent throws NotFoundException when snapshot does not exist', async () => {
    prisma.episodeSnapshot.findUnique.mockResolvedValue(null);

    await expect(service.getSnapshotContent(SNAPSHOT_ID, OWNER_ID)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// 9–10  WorkImportService — getImportStatus ownership
// ---------------------------------------------------------------------------

describe('WorkImportService — getImportStatus ownership', () => {
  const OWNER_ID = 'user-owner';
  const OTHER_ID = 'user-other';
  const IMPORT_ID = 'import-1';

  let service: WorkImportService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    // WorkImportService requires ScoringService, CreditService, and two scrapers.
    // These are not exercised by getImportStatus, so we pass stub objects.
    service = new WorkImportService(
      prisma,
      {} as any,   // ScoringService
      {} as any,   // CreditService
      {} as any,   // NarouScraperService
      {} as any,   // KakuyomuScraperService
    );
  });

  // ── Test 9 ────────────────────────────────────────────────────────────────
  it('9. getImportStatus throws NotFoundException when userId does not match', async () => {
    prisma.workImport.findUnique.mockResolvedValue({
      id: IMPORT_ID,
      userId: OWNER_ID,
      status: 'COMPLETED',
    });

    await expect(service.getImportStatus(IMPORT_ID, OTHER_ID)).rejects.toThrow(NotFoundException);
  });

  // ── Test 10 ───────────────────────────────────────────────────────────────
  it('10. getImportStatus returns data when userId matches', async () => {
    const record = { id: IMPORT_ID, userId: OWNER_ID, status: 'COMPLETED' };
    prisma.workImport.findUnique.mockResolvedValue(record);

    const result = await service.getImportStatus(IMPORT_ID, OWNER_ID);

    expect(result).toEqual(record);
  });

  // ── Extra: getImportStatus throws NotFoundException when record missing ────
  it('getImportStatus throws NotFoundException when record does not exist', async () => {
    prisma.workImport.findUnique.mockResolvedValue(null);

    await expect(service.getImportStatus(IMPORT_ID, OWNER_ID)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// 11–14  CreateTipDto — class-validator constraints
// ---------------------------------------------------------------------------

describe('CreateTipDto — amount validation', () => {
  const VALID_RECIPIENT = 'user-abc';

  async function validate_dto(amount: unknown) {
    const dto = plainToInstance(CreateTipDto, { recipientId: VALID_RECIPIENT, amount });
    return validate(dto);
  }

  // ── Test 11 ───────────────────────────────────────────────────────────────
  it('11. rejects negative amounts', async () => {
    const errors = await validate_dto(-1);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  // ── Test 12 ───────────────────────────────────────────────────────────────
  it('12. rejects amounts over 100000', async () => {
    const errors = await validate_dto(100001);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  // ── Test 13 ───────────────────────────────────────────────────────────────
  it('13. rejects non-integer amounts', async () => {
    const errors = await validate_dto(500.5);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  // ── Test 14 ───────────────────────────────────────────────────────────────
  it('14. accepts valid amounts in the range 100–100000', async () => {
    for (const amount of [100, 500, 1000, 50000, 100000]) {
      const errors = await validate_dto(amount);
      expect(errors.filter((e) => e.property === 'amount')).toHaveLength(0);
    }
  });

  // ── Extra: rejects zero (below minimum) ───────────────────────────────────
  it('rejects zero (below @Min(100))', async () => {
    const errors = await validate_dto(0);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  // ── Extra: rejects missing amount ─────────────────────────────────────────
  it('rejects missing amount field', async () => {
    const dto = plainToInstance(CreateTipDto, { recipientId: VALID_RECIPIENT });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });
});
