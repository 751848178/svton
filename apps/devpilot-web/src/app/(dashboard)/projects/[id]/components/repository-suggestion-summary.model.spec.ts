import { describe, expect, it } from 'vitest';
import type { RepositoryAnalysisSuggestion } from '../types/repository-analysis.types';
import { repositorySuggestionFacts } from './repository-suggestion-summary.model';

describe('repositorySuggestionFacts', () => {
  it('projects a service suggestion into readable component and config facts', () => {
    const facts = repositorySuggestionFacts({
      id: 'suggestion-1', key: 'application_service:api', kind: 'application_service',
      confidence: 'high', conflict: false, impact: '更新组件配置', status: 'pending',
      proposedValue: {
        applicationName: 'Picshare', serviceName: 'api', repoPath: 'apps/api',
        runtime: 'node', ports: [3000],
        deployConfig: { buildCommand: 'pnpm build', startCommand: 'pnpm start' },
      },
    });
    expect(facts).toEqual(expect.arrayContaining([
      { labelKey: 'repositorySuggestionFactComponent', value: 'Picshare / api' },
      { labelKey: 'repositorySuggestionFactRuntime', value: 'node' },
      { labelKey: 'repositorySuggestionFactBuild', value: 'pnpm build' },
    ]));
  });
});
