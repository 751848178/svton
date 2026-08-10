import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchAdapter } from './fetch-adapter';

describe('createFetchAdapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('disables browser cache reuse for authenticated API evidence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, message: 'ok', data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createFetchAdapter().request({
      method: 'GET',
      url: 'http://localhost/api/private-evidence',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/private-evidence',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
});
