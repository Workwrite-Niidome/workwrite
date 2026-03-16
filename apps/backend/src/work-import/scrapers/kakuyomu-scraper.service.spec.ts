import { Test, TestingModule } from '@nestjs/testing';
import { KakuyomuScraperService } from './kakuyomu-scraper.service';

describe('KakuyomuScraperService', () => {
  let service: KakuyomuScraperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KakuyomuScraperService],
    }).compile();

    service = module.get<KakuyomuScraperService>(KakuyomuScraperService);
  });

  // ─── parseUrl ──────────────────────────────────────────────────────────────

  describe('parseUrl', () => {
    it('extracts workId from standard URL', () => {
      expect(service.parseUrl('https://kakuyomu.jp/works/1177354054880246141')).toBe('1177354054880246141');
    });

    it('extracts workId from URL with episode path', () => {
      expect(service.parseUrl('https://kakuyomu.jp/works/1234567890/episodes/111')).toBe('1234567890');
    });

    it('handles case-insensitive domain', () => {
      expect(service.parseUrl('https://Kakuyomu.JP/works/12345')).toBe('12345');
    });

    it('returns null for non-kakuyomu URL', () => {
      expect(service.parseUrl('https://ncode.syosetu.com/n1234ab/')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.parseUrl('')).toBeNull();
    });

    it('returns null for kakuyomu URL without works path', () => {
      expect(service.parseUrl('https://kakuyomu.jp/users/someone')).toBeNull();
    });

    it('returns null for URL with non-numeric workId', () => {
      expect(service.parseUrl('https://kakuyomu.jp/works/abc')).toBeNull();
    });
  });

  // ─── scrape ────────────────────────────────────────────────────────────────

  describe('scrape', () => {
    it('throws error for invalid URL', async () => {
      await expect(service.scrape('https://example.com')).rejects.toThrow(
        '無効なカクヨムURLです',
      );
    });

    it('throws error for empty URL', async () => {
      await expect(service.scrape('')).rejects.toThrow(
        '無効なカクヨムURLです',
      );
    });
  });
});
