'use client';

import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import { ReleasePostValidationDrawerEvidence } from './release-post-validation-drawer-evidence';

export function ReleasePostValidationDrawer(props: {
  open: boolean;
  evidence: ReleaseLifecycleEvidence;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const run = props.evidence.productionRun;
  const deployment = props.evidence.productionDeployment;
  const version = props.evidence.currentProductionVersion;
  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      title={t('releasePostValidationDrawerTitle')}
      description={t('releasePostValidationDrawerDescription')}
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      {run ? (
        <div className="space-y-4">
          <dl className="grid gap-3 rounded-lg border p-3 text-xs sm:grid-cols-2">
            <Fact
              label="ReleaseRun"
              value={run.id}
              mono
            />
            <Fact
              label="DeploymentRun"
              value={deployment?.id || '—'}
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
              value={version?.releaseVersion || '—'}
            />
            <Fact
              label="EnvironmentVersion"
              value={version?.id || '—'}
              mono
            />
            <Fact
              label={t('releaseStagingEvidenceTimeColumn')}
              value={formatIso(version?.effectiveAt)}
            />
          </dl>

          <ReleasePostValidationDrawerEvidence deployment={deployment} />
        </div>
      ) : null}
    </Drawer>
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
