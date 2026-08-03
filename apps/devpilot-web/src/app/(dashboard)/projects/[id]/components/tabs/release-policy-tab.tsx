'use client';

import { useTranslations } from 'next-intl';
import { Button, Card } from '@svton/ui';
import { useReleasePolicy } from '../../hooks/use-release-policy';
import type { ReleaseStrategy } from '../../types/release-policy.types';

const STRATEGY_KEYS: Record<ReleaseStrategy, string> = {
  standard: 'releasePolicyStrategyStandard',
  canary: 'releasePolicyStrategyCanary',
  blue_green: 'releasePolicyStrategyBlueGreen',
  automatic_traffic: 'releasePolicyStrategyAutomaticTraffic',
};

export function ReleasePolicyTab({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const policy = useReleasePolicy(projectId);

  if (policy.loading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (!policy.policy) return <p className="text-sm text-destructive">{policy.error}</p>;
  const current = policy.policy.current;

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
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Value label={t('releasePolicyCurrent')} value={t(STRATEGY_KEYS[current.strategy] as never)} />
          <Value
            label={t('releasePolicyRevision')}
            value={current.synthetic ? t('releasePolicySynthetic') : `R${current.revision}`}
          />
          <Value label={t('releasePolicyApproval')} value={t('releasePolicyApprovalRequired')} />
        </dl>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {policy.policy.capabilities.map((capability) => (
          <Card key={capability.strategy} className={capability.executable ? 'border-emerald-500/40' : ''}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{t(STRATEGY_KEYS[capability.strategy] as never)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{capability.reason}</p>
              </div>
              <span className={capability.executable
                ? 'rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700'
                : 'rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground'}>
                {capability.executable ? t('releasePolicyAvailable') : t('releasePolicyUnavailable')}
              </span>
            </div>
            {capability.missingCapabilities.length ? (
              <p className="mt-3 break-words font-mono text-xs text-muted-foreground">
                {t('releasePolicyMissing')}: {capability.missingCapabilities.join(' · ')}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
      {policy.error ? <p className="text-sm text-destructive">{policy.error}</p> : null}
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

