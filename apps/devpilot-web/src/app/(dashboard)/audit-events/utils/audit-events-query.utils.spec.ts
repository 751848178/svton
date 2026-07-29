import { describe, expect, it } from 'vitest';
import {
  auditEventScopeFromSearchParams,
  auditEventsApiName,
} from './audit-events-query.utils';

describe('audit event query utilities', () => {
  it('keeps only supported, non-empty scope values', () => {
    expect(auditEventScopeFromSearchParams({
      projectId: ' project-1 ',
      category: ['repository_analysis', 'ignored'],
      targetId: 'run-1',
      status: '',
    })).toEqual({
      projectId: 'project-1',
      category: 'repository_analysis',
    });
  });

  it('builds an encoded API cache key', () => {
    expect(auditEventsApiName({
      projectId: 'project/1',
      category: 'repository analysis',
    })).toBe(
      'GET:/audit-events?projectId=project%2F1&category=repository+analysis',
    );
  });
});
