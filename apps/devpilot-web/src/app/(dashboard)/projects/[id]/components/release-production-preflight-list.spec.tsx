import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseProductionPreflightList } from './release-production-preflight-list';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

describe('ReleaseProductionPreflightList', () => {
  it('presents D13 as a deferred next step and repairs D17 only', () => {
    const html = renderToStaticMarkup(<ReleaseProductionPreflightList checks={[
      check('D13', undefined, true),
      check('D17', '/applications?environmentId=prod-1&serviceId=api', false),
    ] as never} />);
    expect(html).toContain('releaseProductionGateStatus_next_step');
    expect(html).toContain('releaseProductionGateDeferredUntilApproval');
    expect(html).toContain('/applications?environmentId=prod-1&amp;serviceId=api');
    expect(html.match(/releaseProductionRepairGate/g)).toHaveLength(1);
  });
});

function check(id: string, repairHref: string | undefined, deferredUntilApproval: boolean) {
  return {
    id, status: 'manual', reasonCode: 'reason',
    reason: { zh: '原因', en: 'Reason' }, providerKey: 'provider',
    checkedAt: null, repairHref, localOnly: false, deferredUntilApproval,
  };
}
