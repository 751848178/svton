/**
 * 项目设置 · 发布规则（Demo policySettingsV12 对齐，AC-POLICY-001..010）
 *
 * 单一职责：以 Demo「当前发布规则」页的信息结构展示当前生效策略——生效徽标
 * （policy-r{n} · 当前生效 / 系统默认 · 当前生效）、快照哈希（AC-POLICY-001）、
 * 四项事实（发布顺序/制品策略/生产保护/并发控制）、标准发布策略卡、生产发布
 * 门禁表（预发验证成功/配置就绪/人工审批/部署后验证）与 Demo callout（新修订只
 * 影响之后创建的运行）。保存标准修订走 append-only CAS 新修订（AC-POLICY-003）。
 * 高级策略卡只读（AC-POLICY-008/009）：能力未就绪的具体原因 + 缺失能力清单，
 * 无任何选择器。目标规则区块诚实说明变更窗口/冻结期 Provider 未接入（字段保持
 * 空值），实际执行以 D13 门禁 + 冻结 Manifest/配置 CAS 为准（AC-POLICY-006）。
 */
'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Card } from '@svton/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { useReleasePolicy } from '../../hooks/use-release-policy';
import type { ReleaseStrategy } from '../../types/release-policy.types';

const STRATEGY_KEYS: Record<ReleaseStrategy, string> = {
  standard: 'releasePolicyStrategyStandard',
  canary: 'releasePolicyStrategyCanary',
  blue_green: 'releasePolicyStrategyBlueGreen',
  automatic_traffic: 'releasePolicyStrategyAutomaticTraffic',
};

const GATES: Array<{ labelKey: string; descKey: string }> = [
  { labelKey: 'releasePolicyGateStagingVerified', descKey: 'releasePolicyGateStagingVerifiedDesc' },
  { labelKey: 'releasePolicyGateConfigReady', descKey: 'releasePolicyGateConfigReadyDesc' },
  { labelKey: 'releasePolicyGateHumanApproval', descKey: 'releasePolicyGateHumanApprovalDesc' },
  { labelKey: 'releasePolicyGatePostDeployVerified', descKey: 'releasePolicyGatePostDeployVerifiedDesc' },
];

export function ReleasePolicyTab({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const policy = useReleasePolicy(projectId);

  if (policy.loading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (!policy.policy) return <p className="text-sm text-destructive">{policy.error}</p>;
  const current = policy.policy.current;
  const revisionLabel = current.synthetic
    ? t('releasePolicySynthetic')
    : `policy-r${current.revision}`;
  const creator = current.createdBy?.name ?? t('releasePolicySystemCreator');

  return (
    <div className="max-w-4xl space-y-4">
      <Card
        title={t('releasePolicyTitle')}
        extra={
          <Button size="sm" variant="primary" disabled={policy.saving} onClick={policy.saveStandard}>
            {policy.saving ? t('releasePolicySaving') : t('releasePolicySaveStandard')}
          </Button>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">{t('releasePolicyDescription')}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
            {revisionLabel} · {t('releasePolicyEffectiveBadge')}
          </span>
          <span className="text-sm text-muted-foreground">
            {t(STRATEGY_KEYS[current.strategy] as never)}
            {current.createdAt ? ` · ${formatDateTimeMinute(current.createdAt)}` : ''}
            {' · '}
            {t('releasePolicyEnabledBy', { name: creator })}
          </span>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          {t('releasePolicySnapshotHash')}:{' '}
          <span className="break-all font-mono">{current.snapshotHash}</span>
        </p>

        <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Value label={t('releasePolicyFactReleaseOrder')} value={t('releasePolicyFactReleaseOrderValue')} />
          <Value label={t('releasePolicyFactArtifactPolicy')} value={t('releasePolicyFactArtifactPolicyValue')} />
          <Value label={t('releasePolicyFactProductionProtection')} value={t('releasePolicyApprovalRequired')} />
          <Value label={t('releasePolicyFactConcurrency')} value={t('releasePolicyFactConcurrencyValue')} />
        </dl>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
          <span className="text-sm font-medium">{t(STRATEGY_KEYS[current.strategy] as never)}</span>
          <span className="text-xs text-muted-foreground">{t('releasePolicyStandardCardDescription')}</span>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">{t('releasePolicyGatesTitle')}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">{t('releasePolicyGateTableGate')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('releasePolicyGateTableState')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {GATES.map((gate) => (
                <tr key={gate.labelKey}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{t(gate.labelKey)}</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t(gate.descKey)}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-block rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-800">
                      {t('releasePolicyGateEnabled')}
                    </span>{' '}
                    <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      {t('releasePolicyEffectiveBadge')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('releasePolicyCallout')}
        </p>
      </Card>

      <Card title={t('releasePolicyStrategiesTitle')}>
        <p className="mb-4 text-sm text-muted-foreground">{t('releasePolicyReadOnlyHint')}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {policy.policy.capabilities.map((capability) => (
            <div
              key={capability.strategy}
              className={
                capability.executable
                  ? 'rounded-lg border border-emerald-500/40 p-4'
                  : 'rounded-lg border border-border bg-muted/20 p-4'
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{t(STRATEGY_KEYS[capability.strategy] as never)}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {locale.startsWith('zh') ? capability.reason.zh : capability.reason.en}
                  </p>
                </div>
                <span
                  className={
                    capability.executable
                      ? 'shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-800'
                      : 'shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-slate-700'
                  }
                >
                  {capability.executable ? t('releasePolicyAvailable') : t('releasePolicyUnavailable')}
                </span>
              </div>
              {capability.missingCapabilities.length ? (
                <p className="mt-3 break-words font-mono text-xs text-muted-foreground">
                  {t('releasePolicyMissing')}: {capability.missingCapabilities.join(' · ')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('releasePolicyTargetRulesTitle')}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Value label={t('releasePolicyTargetRulesChangeWindow')} value={t('releasePolicyTargetRulesUnavailable')} />
          <Value label={t('releasePolicyTargetRulesFreeze')} value={t('releasePolicyTargetRulesUnavailable')} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{t('releasePolicyTargetRulesEnforced')}</p>
      </Card>

      {policy.error ? <p className="text-sm text-destructive">{policy.error}</p> : null}
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}
