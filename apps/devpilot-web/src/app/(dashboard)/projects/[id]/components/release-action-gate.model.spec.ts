import { describe, expect, it } from 'vitest';
import { releaseGateCatalogFixture } from './release-gate-catalog.spec-fixtures';
import { releaseActionGate } from './release-action-gate.model';

describe('releaseActionGate', () => {
  it('fails closed while the decision is unavailable', () => {
    expect(releaseActionGate(null, 'build', { loading: false, error: '' }, 'zh')).toEqual({
      allowed: false,
      reason: '门禁结论不可用',
    });
  });

  it('surfaces the blocking gate reason and rejects manual gates', () => {
    const catalog = releaseGateCatalogFixture();
    const check = catalog.checks.find((item) => item.id === 'C01')!;
    check.reason = { zh: '仓库来源不可用', en: 'Repository unavailable' };
    catalog.decisions.build = {
      ...catalog.decisions.build,
      allowed: false,
      blockerGateIds: ['C01'],
    };
    expect(releaseActionGate(catalog, 'build', { loading: false, error: '' }, 'zh')).toEqual({
      allowed: false,
      reason: '仓库来源不可用',
    });
  });

  it.each([
    ['TARGET_MISSING', 'Staging 尚未绑定部署目标'],
    ['TARGET_DUPLICATED', 'Staging 存在重复的部署目标绑定'],
    ['PROVIDER_MISMATCH', '部署目标与当前 Provider 不匹配'],
    ['SSH_ROOT_INVALID', 'SSH 部署根目录缺失或不安全'],
  ] as const)('fails staging closed for target readiness %s', (reasonCode, reason) => {
    const catalog = releaseGateCatalogFixture();
    catalog.targetReadiness = {
      ...catalog.targetReadiness,
      matchState: 'missing',
      reasonCode,
      currentTarget: null,
      remediation: 'environment_targets',
    };
    expect(releaseActionGate(catalog, 'staging', { loading: false, error: '' }, 'zh')).toEqual({
      allowed: false,
      reason,
      repairArea: 'targets',
    });
  });
});
