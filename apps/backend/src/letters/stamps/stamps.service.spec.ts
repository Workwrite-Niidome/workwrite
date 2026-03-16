import { Test, TestingModule } from '@nestjs/testing';
import { StampsService } from './stamps.service';

describe('StampsService', () => {
  let service: StampsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StampsService],
    }).compile();

    service = module.get<StampsService>(StampsService);
  });

  // ─── getStamps ─────────────────────────────────────────────────────────────

  describe('getStamps', () => {
    it('returns stamps and categories', () => {
      const result = service.getStamps();

      expect(result).toHaveProperty('stamps');
      expect(result).toHaveProperty('categories');
      expect(Array.isArray(result.stamps)).toBe(true);
    });

    it('returns at least one stamp per category', () => {
      const { stamps, categories } = service.getStamps();
      const categoryKeys = Object.keys(categories);

      for (const cat of categoryKeys) {
        const stampsInCategory = stamps.filter((s) => s.category === cat);
        expect(stampsInCategory.length).toBeGreaterThan(0);
      }
    });

    it('has 4 categories (cheer, celebration, emotion, seasonal)', () => {
      const { categories } = service.getStamps();
      expect(Object.keys(categories)).toEqual(
        expect.arrayContaining(['cheer', 'celebration', 'emotion', 'seasonal']),
      );
      expect(Object.keys(categories)).toHaveLength(4);
    });

    it('each stamp has id, name, emoji, category', () => {
      const { stamps } = service.getStamps();

      for (const stamp of stamps) {
        expect(stamp.id).toBeDefined();
        expect(stamp.name).toBeDefined();
        expect(stamp.emoji).toBeDefined();
        expect(stamp.category).toBeDefined();
      }
    });

    it('stamp IDs are unique', () => {
      const { stamps } = service.getStamps();
      const ids = stamps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ─── getStamp ──────────────────────────────────────────────────────────────

  describe('getStamp', () => {
    it('returns a stamp by known ID', () => {
      const stamp = service.getStamp('cheer-1');
      expect(stamp).toBeDefined();
      expect(stamp!.id).toBe('cheer-1');
      expect(stamp!.name).toBe('ファイト');
      expect(stamp!.emoji).toBe('💪');
    });

    it('returns undefined for unknown ID', () => {
      expect(service.getStamp('nonexistent-999')).toBeUndefined();
    });

    it('returns undefined for empty string ID', () => {
      expect(service.getStamp('')).toBeUndefined();
    });
  });
});
