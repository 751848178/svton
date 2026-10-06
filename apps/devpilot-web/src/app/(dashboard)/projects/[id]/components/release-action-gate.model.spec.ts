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
    ['TARGET_MISSING', 'Staging 尚未绑定部署目标，请在 项目配置 → 部署目标 中绑定'],
    ['TARGET_DUPLICATED', 'Staging 绑定了多个部署目标，请保留一个后再发布'],
    ['PROVIDER_MISMATCH', '预发（Staging）绑定的部署目标类型与本次发布要求的不一致（需要 SSH 服务器）'],
    ['SSH_ROOT_INVALID', '部署目标的 SSH 根目录缺失或不安全，请检查部署目标设置'],
  ] as const)('fails staging closed for target readiness %s', (reasonCode, reason) => {
    const catalog = releaseGateCatalogFixture();
    catalog.targetReadiness = {
      ...catalog.targetReadiness,
      matchState: 'missing',
      reasonCode,
      // PROVIDER_MISMATCH 文案包含期望的部署目标类型名（fixture 期望 ssh-v1）。
      expectedProviderKey: 'ssh-v1',
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
