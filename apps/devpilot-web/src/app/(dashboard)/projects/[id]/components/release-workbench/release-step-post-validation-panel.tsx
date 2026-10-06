'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import { ReleasePostValidationDrawer } from './release-post-validation-drawer';
import { ReleasePostValidationList } from './release-post-validation-list';

export function ReleaseStepPostValidationPanel(props: {
  lifecycleEvidence: ReleaseLifecycleEvidence;
}) {
  const t = useTranslations('projects');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const run = props.lifecycleEvidence.productionRun;
  const checks = props.lifecycleEvidence.validationChecks;
  if (!run) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        {t('releasePostValidationEmpty')}
      </p>
    );
  }
  const passed = checks.filter((check) => check.tone === 'success').length;
  const deployment = props.lifecycleEvidence.productionDeployment;
  const version = props.lifecycleEvidence.currentProductionVersion;
  const failed = checks.some((check) => check.tone === 'danger');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('releasePostValidationTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('releasePostValidationDescription')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FlowStatusTag
            status={
              props.lifecycleEvidence.validation === 'passed'
                ? 'success'
                : props.lifecycleEvidence.validation === 'failed'
                  ? 'danger'
                  : 'warning'
            }
            label={t('releasePostValidationProgress', { passed, total: checks.length })}
          />
          <Button
            id="post-validation-evidence-trigger"
            variant="secondary"
            size="sm"
            onClick={() => setDrawerOpen(true)}
          >
            {t('releaseStagingViewEvidence')}
          </Button>
        </div>
      </div>
      <dl className="grid gap-3 rounded-lg border p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          label="ReleaseRun"
          value={shortTechnicalId(run.id)}
          title={run.id}
          mono
        />
        <Fact
          label="DeploymentRun"
          value={deployment ? shortTechnicalId(deployment.id) : '—'}
          title={deployment?.id}
          mono
        />
        <Fact
          label={t('productionArtifact')}
          value={shortDigest(run.manifest.digest)}
          title={run.manifest.digest}
          mono
        />
        <Fact
          label={t('releaseCompletionVersion')}
          value={version ? `${version.releaseVersion} · ${formatIso(version.effectiveAt)}` : '—'}
        />
      </dl>
      {!deployment || !version || failed ? (
        <p
          className={`rounded-lg border p-3 text-sm ${failed ? 'border-destructive/40 text-destructive' : 'text-muted-foreground'}`}
          role={failed ? 'alert' : 'status'}
        >
          {failed
            ? t('releasePostValidationFailedBlocker')
            : !deployment
              ? t('releasePostValidationDeploymentUnavailable')
              : t('releasePostValidationVersionUnavailable')}
        </p>
      ) : null}
      <ReleasePostValidationList checks={checks} />
      <ReleasePostValidationDrawer
        open={drawerOpen}
        evidence={props.lifecycleEvidence}
        onClose={() => {
          setDrawerOpen(false);
          requestAnimationFrame(() =>
            document.getElementById('post-validation-evidence-trigger')?.focus(),
          );
        }}
      />
    </div>
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-1 break-all ${props.mono ? 'font-mono' : ''}`}
        title={props.title}
      >
        {props.value}
      </dd>
    </div>
  );
}
