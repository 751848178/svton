import { describe, expect, it } from 'vitest';
import { buildEnvironmentRequirementSuggestions } from './settings-env-requirements.model';

describe('buildEnvironmentRequirementSuggestions', () => {
  it('reads only safe variable metadata persisted by repository analysis', () => {
    const suggestions = buildEnvironmentRequirementSuggestions([{
      id: 'app-1', name: 'Picshare', services: [{
        id: 'service-web', name: 'frontend', kind: 'container', status: 'active',
        environment: { id: 'staging', key: 'staging', name: 'Staging', status: 'active' },
        metadata: { repositoryAnalysis: { environment: [
          { name: 'API_BASE_URL', required: true, secret: false, evidence: [{ file: 'apps/web/.env.example', detail: '变量名 API_BASE_URL' }] },
          { name: 'JWT_SECRET', required: true, secret: true, evidence: [{ file: 'apps/web/src/config.ts', detail: '变量名 JWT_SECRET' }] },
          { name: 'bad-key', required: false, secret: false, value: 'must-not-leak' },
        ] } },
      }],
    }], 'staging');

    expect(suggestions).toEqual([
      { serviceId: 'service-web', component: 'frontend', key: 'API_BASE_URL', required: true, sensitive: false, evidence: [{ file: 'apps/web/.env.example', detail: '变量名 API_BASE_URL' }] },
      { serviceId: 'service-web', component: 'frontend', key: 'JWT_SECRET', required: true, sensitive: true, evidence: [{ file: 'apps/web/src/config.ts', detail: '变量名 JWT_SECRET' }] },
    ]);
    expect(JSON.stringify(suggestions)).not.toContain('must-not-leak');
  });

  it('returns empty when no persisted repository-analysis evidence exists', () => {
    expect(buildEnvironmentRequirementSuggestions([], 'staging')).toEqual([]);
  });
});
