import { NextRequest } from 'next/server';
import { middleware } from './middleware';

describe('middleware auth routing', () => {
  it('redirects an unauthenticated protected request to login', () => {
    const response = middleware(request('/projects?view=delivery'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?redirect=%2Fprojects%3Fview%3Ddelivery',
    );
  });

  it('allows a protected request with a token cookie', () => {
    const response = middleware(request('/projects', 'token=valid-token'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('keeps login reachable when only a stale token cookie remains', () => {
    const response = middleware(
      request('/login?redirect=%2Fprojects', 'token=stale-cross-port-token'),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });
});

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}
