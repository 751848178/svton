import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RepositorySuggestionReadableValue } from './repository-suggestion-readable-value';

describe('RepositorySuggestionReadableValue', () => {
  it('keeps readable facts primary and raw JSON in a technical disclosure', () => {
    const html = renderToStaticMarkup(
      <RepositorySuggestionReadableValue
        item={{
          id: 'suggestion-1', key: 'project_repository', kind: 'project_repository',
          confidence: 'high', conflict: false, impact: '更新仓库', status: 'pending',
          proposedValue: {
            gitRepo: 'file:///repo',
            source: { branch: 'master', commitSha: 'a1b2c3d4' },
          },
        }}
      />,
    );
    expect(html).toContain('file:///repo');
    expect(html).toContain('master');
    expect(html).toContain('技术证据：查看原始建议');
    expect(html.indexOf('file:///repo')).toBeLessThan(html.indexOf('<details'));
    expect(html.indexOf('<pre')).toBeGreaterThan(html.indexOf('<details'));
  });
});
