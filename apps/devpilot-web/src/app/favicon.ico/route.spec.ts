import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('favicon response', () => {
  it('returns a bodyless success that survives the Next production adapter', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Content-Length')).toBe('0');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});
