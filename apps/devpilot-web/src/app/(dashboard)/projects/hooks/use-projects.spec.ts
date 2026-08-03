import { buildDirectoryQuery } from './use-projects';

describe('buildDirectoryQuery', () => {
  it('keeps the unfiltered query stable for the server fallback', () => {
    expect(buildDirectoryQuery('', 'all', 'all')).toBe('GET:/project-directory?take=100');
  });

  it('encodes server-side search and status filters', () => {
    expect(buildDirectoryQuery('pay & ship', 'running', 'needs_configuration')).toBe(
      'GET:/project-directory?take=100&search=pay+%26+ship&runtimeStatus=running&configurationStatus=needs_configuration',
    );
  });
});
