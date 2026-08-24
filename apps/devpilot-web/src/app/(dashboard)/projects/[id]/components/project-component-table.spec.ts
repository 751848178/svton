import { describe, expect, it } from 'vitest';
import type { RepositoryAnalysisSuggestion } from '../types/repository-analysis.types';
import { findChange } from './project-component-table';

function suggestion(serviceName: string, status: 'applied' | 'pending' = 'applied') {
  return {
    id: `sug-${serviceName}`,
    key: `application_service:${serviceName}`,
    kind: 'application_service',
    status,
    proposedValue: {
      applicationName: 'Picshare App',
      serviceName,
      runtime: 'node',
      ports: [serviceName === 'backend' ? 3000 : 3001],
    },
  } as RepositoryAnalysisSuggestion;
}

describe('findChange (INFO-11: 组件行只能命中自己的建议)', () => {
  it('maps each service row to its own applied suggestion via serviceName', () => {
    const items = [suggestion('admin'), suggestion('backend')];
    const backend = findChange(items, 'Picshare App', 'backend');
    const admin = findChange(items, 'Picshare App', 'admin');
    expect((backend?.proposedValue as { ports: number[] }).ports).toEqual([3000]);
    expect((admin?.proposedValue as { ports: number[] }).ports).toEqual([3001]);
  });

  it('does not let the app-name fallback capture the first suggestion for every row', () => {
    // backend 建议缺失时，backend 行不得显示 admin 的建议（历史缺陷形态）
    const items = [suggestion('admin')];
    expect(findChange(items, 'Picshare App', 'backend')).toBeUndefined();
    expect(findChange(items, 'Picshare App', 'admin')).toBeDefined();
  });

  it('ignores pending suggestions', () => {
    const items = [suggestion('backend', 'pending')];
    expect(findChange(items, 'Picshare App', 'backend')).toBeUndefined();
  });
});
