import { Test, TestingModule } from '@nestjs/testing';
import { NarouScraperService } from './narou-scraper.service';

describe('NarouScraperService', () => {
  let service: NarouScraperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NarouScraperService],
    }).compile();

    service = module.get<NarouScraperService>(NarouScraperService);
  });

  // ─── parseUrl ──────────────────────────────────────────────────────────────

  describe('parseUrl', () => {
    it('extracts ncode from standard URL', () => {
      expect(service.parseUrl('https://ncode.syosetu.com/n1234ab/')).toBe('n1234ab');
    });

    it('extracts ncode from URL without trailing slash', () => {
      expect(service.parseUrl('https://ncode.syosetu.com/n1234ab')).toBe('n1234ab');
    });

    it('extracts ncode from URL with episode path', () => {
      expect(service.parseUrl('https://ncode.syosetu.com/n9999zz/1/')).toBe('n9999zz');
    });

    it('handles case-insensitive domain', () => {
      expect(service.parseUrl('https://Ncode.Syosetu.com/n1234ab/')).toBe('n1234ab');
    });

    it('returns null for non-narou URL', () => {
      expect(service.parseUrl('https://kakuyomu.jp/works/12345')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.parseUrl('')).toBeNull();
    });

    it('returns null for malformed URL without ncode', () => {
      expect(service.parseUrl('https://ncode.syosetu.com/')).toBeNull();
    });

    it('returns null for URL with invalid ncode format (no leading n)', () => {
      // ncode must start with 'n'
      expect(service.parseUrl('https://ncode.syosetu.com/x1234ab/')).toBeNull();
    });
  });

  // ─── scrape ────────────────────────────────────────────────────────────────

  describe('scrape', () => {
    it('throws error for invalid URL', async () => {
      await expect(service.scrape('https://example.com')).rejects.toThrow(
        '無効ななろうURLです',
      );
    });

    it('throws error for empty URL', async () => {
      await expect(service.scrape('')).rejects.toThrow(
        '無効ななろうURLです',
      );
    });
  });
});
