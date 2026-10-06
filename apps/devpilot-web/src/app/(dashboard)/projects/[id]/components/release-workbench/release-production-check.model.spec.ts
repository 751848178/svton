import { describe, expect, it } from 'vitest';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import {
  productionApprovalCheck,
  productionCheckCounts,
  productionCheckStatusKey,
  productionCheckTone,
  productionRouteTargets,
} from './release-production-check.model';

describe('release production check model', () => {
  it('maps structured route and TLS fields without inventing target values', () => {
    const targets = productionRouteTargets(
      preview({
        entries: [
          {
            domain: 'api.example.com',
            path: '/v1',
            serviceId: 'service-1',
            component: 'api',
            port: 3000,
            tlsMode: 'managed_cert',
          },
        ],
      }),
    );
    expect(targets).toEqual([
      {
        key: 'api.example.com:/v1:0',
        domain: 'api.example.com',
        path: '/v1',
        component: 'api',
        port: 3000,
        tlsMode: 'managed_cert',
        tlsRequired: null,
      },
    ]);
  });

  it('keeps missing legacy route fields unavailable', () => {
    expect(productionRouteTargets(preview({ domains: ['legacy.example.com'] }))[0]).toMatchObject({
      domain: 'legacy.example.com',
      path: null,
      component: null,
      port: null,
      tlsMode: null,
      tlsRequired: null,
    });
  });

  it('counts exact preview statuses and finds the deferred approval gate', () => {
    const value = preview({});
    expect(productionCheckCounts(value)).toEqual({
      total: 3,
      passed: 1,
      blocked: 1,
      unavailable: 1,
    });
    expect(productionApprovalCheck(value)?.deferredUntilApproval).toBe(true);
    expect(
      ['success', 'danger', 'warning', 'neutral'].map((_, index) =>
        productionCheckTone(['checked', 'blocked', 'manual', 'unavailable'][index]!),
      ),
    ).toEqual(['success', 'danger', 'warning', 'neutral']);
    expect(productionCheckStatusKey('future_status')).toBe('releaseStagingCheckStatus.unavailable');
  });
});

function preview(routeSnapshot: Record<string, unknown>) {
  return {
    snapshot: { config: { routeSnapshot } },
    preflight: {
      checks: [
        { id: 'D01', status: 'checked' },
        { id: 'D05', status: 'blocked' },
        { id: 'D13', status: 'unavailable', deferredUntilApproval: true },
      ],
    },
  } as ProductionReleasePreview;
}
