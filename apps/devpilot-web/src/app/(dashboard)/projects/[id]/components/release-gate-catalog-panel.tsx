'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { useReleaseGateCatalog } from '../hooks/use-release-gate-catalog';
import type {
  LocalizedGateText,
  ReleaseGatePhase,
  ReleaseGateStatus,
} from '../types/release-gate.types';

const PHASES: ReleaseGatePhase[] = ['commit', 'build', 'deploy', 'promote'];

export function ReleaseGateCatalogPanel({
  projectId,
  releaseOrderId,
}: {
  projectId: string;
  releaseOrderId: string;
}) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const { catalog, loading, error, load } = useReleaseGateCatalog(projectId, releaseOrderId);
  const [expanded, setExpanded] = useState(false);
  const localize = (text: LocalizedGateText) => locale.startsWith('zh') ? text.zh : text.en;

  return (
    <section className="space-y-3 rounded-md border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">{t('releaseGateCatalogTitle')}</h4>
          <p className="text-xs text-muted-foreground">
            {catalog
              ? t('releaseGateCatalogSummary', {
                  total: catalog.summary.total,
                  unavailable: catalog.summary.statusCounts.unavailable,
                })
              : t('releaseGateCatalogDescription')}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? t('releaseGateCatalogCollapse') : t('releaseGateCatalogExpand')}
        </Button>
      </div>

      {loading ? <p className="text-xs text-muted-foreground">{t('loading')}</p> : null}
      {error ? (
        <div className="flex items-center justify-between gap-2 text-xs text-destructive">
          <span>{error}</span><button type="button" onClick={() => void load()}>{t('retry')}</button>
        </div>
      ) : null}

      {expanded && catalog ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{catalog.catalogVersion}</span>
            <span>·</span>
            <span>{catalog.capabilityVersion}</span>
            <span>·</span>
            <span>{t('releaseGateCapabilityCount', { count: catalog.capabilities.length })}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {PHASES.map((phase) => (
              <GatePhase
                key={phase}
                phase={phase}
                checks={catalog.checks.filter((check) => check.phase === phase)}
                localize={localize}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GatePhase({
  phase,
  checks,
  localize,
}: {
  phase: ReleaseGatePhase;
  checks: NonNullable<ReturnType<typeof useReleaseGateCatalog>['catalog']>['checks'];
  localize: (text: LocalizedGateText) => string;
}) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold">{t(`releaseGatePhase.${phase}`)}</h5>
        <span className="text-xs text-muted-foreground">{checks.length}</span>
      </div>
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.id} className="rounded-md border px-2 py-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <span><strong className="font-mono">{check.id}</strong> · {localize(check.title)}</span>
              <StatusTag status={statusTone(check.status)} label={t(`releaseGateStatus.${check.status}`)} />
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
              <span>{check.capabilityId ?? 'Target'}</span>
              <span>·</span>
              <span>{localize(check.reason)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusTone(status: ReleaseGateStatus) {
  if (status === 'checked') return 'success';
  if (status === 'blocked') return 'error';
  if (status === 'warning' || status === 'manual') return 'warning';
  return 'neutral';
}
