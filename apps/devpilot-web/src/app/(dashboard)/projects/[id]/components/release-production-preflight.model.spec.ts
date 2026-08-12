import { describe, expect, it } from 'vitest';
import { productionPreflightView } from './release-production-preflight.model';

describe('productionPreflightView', () => {
  const preflight = {
    decision: {
      blockerGateIds: ['D08'], manualGateIds: [], integrityErrors: [],
    },
    checks: [{
      id: 'D08', reason: { zh: '中文原因', en: 'English reason' },
    }],
  } as never;

  it('uses the active locale for the primary blocker reason', () => {
    expect(productionPreflightView(preflight, 'zh-CN').reason).toBe('中文原因');
    expect(productionPreflightView(preflight, 'en-US').reason).toBe('English reason');
  });
});
