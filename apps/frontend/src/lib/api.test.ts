import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the ApiClient's request behavior by calling public methods
// that delegate to the private request() method.

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Import after mocks are set up
const { api, ApiError } = await import('./api');

describe('ApiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
    api.setToken(null);
  });

  describe('request() - 204 No Content handling', () => {
    it('should return undefined for 204 No Content responses (e.g. DELETE)', async () => {
      api.setToken('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: () => { throw new Error('No body'); },
      });

      // deletePost calls request<void>('/posts/:id', { method: 'DELETE' })
      const result = await api.deletePost('post-123');
      expect(result).toBeUndefined();
    });

    it('should return undefined for responses with content-length: 0', async () => {
      api.setToken('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '0' }),
        json: () => { throw new Error('No body'); },
      });

      // Use any void-returning endpoint
      const result = await api.unfollowUser('user-123');
      expect(result).toBeUndefined();
    });

    it('should parse JSON for normal 200 responses', async () => {
      api.setToken('test-token');

      const mockData = { data: { id: 'post-1', content: 'Hello' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await api.getPost('post-1');
      expect(result).toEqual(mockData);
    });
  });

  describe('request() - error handling', () => {
    it('should throw ApiError for 404 responses', async () => {
      api.setToken('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: 'Not found' } }),
      });

      await expect(api.getPost('nonexistent')).rejects.toThrow('Not found');
    });

    it('should throw ApiError with specific message for 500 responses', async () => {
      api.setToken('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: 'Internal error' } }),
      });

      await expect(api.getPost('post-1')).rejects.toThrow('Internal error');
    });

    it('should throw ApiError when network fails', async () => {
      api.setToken('test-token');

      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(api.getPost('post-1')).rejects.toThrow('サーバーに接続できません');
    });
  });

  describe('request() - authentication', () => {
    it('should include Authorization header when token is set', async () => {
      api.setToken('my-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ data: {} }),
      });

      await api.getPost('post-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('should not include Authorization header when no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ data: {} }),
      });

      await api.getPost('post-1');

      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders.Authorization).toBeUndefined();
    });
  });
});
