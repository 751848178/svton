import { describe, expect, it } from 'vitest';
import { countActionableApprovals } from './dashboard-approval-stats.utils';

describe('countActionableApprovals', () => {
  it('counts only approvals explicitly reviewable by the current actor', () => {
    expect(
      countActionableApprovals([
        { id: 'admin', status: 'pending', capabilities: { review: true } },
        { id: 'member', status: 'pending', capabilities: { review: false } },
        { id: 'legacy', status: 'pending' },
      ]),
    ).toBe(1);
  });
});
