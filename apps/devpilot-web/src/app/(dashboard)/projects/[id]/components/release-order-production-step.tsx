'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import { useProductionReleases } from '../hooks/use-production-releases';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { releaseOrderStatusTone } from '../utils/release-order.utils';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onChanged: () => Promise<unknown>;
}

export function ReleaseOrderProductionStep(props: Props) {
  const t = useTranslations('projects');
  const builds = useReleaseBuilds(props.projectId, props.releaseOrderId, props.onChanged);
  const staging = useReleaseStagingDeployments(props.projectId, props.releaseOrderId);
  const provenManifestIds = useMemo(
    () =>
      new Set(
        staging.items
          .filter((item) => item.status === 'completed' && item.artifactManifestId)
          .map((item) => item.artifactManifestId as string),
      ),
    [staging.items],
  );
  const candidates = useMemo(
    () => builds.items.filter((item) => item.manifest && provenManifestIds.has(item.manifest.id)),
    [builds.items, provenManifestIds],
  );
  const [requestedManifestId, setRequestedManifestId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const manifestId = candidates.some((item) => item.manifest?.id === requestedManifestId)
    ? requestedManifestId
    : candidates[0]?.manifest?.id || '';
  const production = useProductionReleases(props.projectId, props.releaseOrderId, manifestId);
  const snapshot = production.preview?.snapshot;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{t('releaseStepProductionTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('releaseProductionDescription')}</p>
      </div>
      <div className="space-y-4 rounded-md border p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('releaseProductionManifestLabel')}</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={manifestId}
            onChange={(event) => {
              setRequestedManifestId(event.target.value);
              setConfirmed(false);
            }}
            disabled={production.confirming}
          >
            {candidates.length === 0 ? (
              <option value="">{t('releaseProductionNoManifest')}</option>
            ) : null}
            {candidates.map((build) => (
              <option
                key={build.manifest!.id}
                value={build.manifest!.id}
              >
                {t('releaseProductionManifestOption', {
                  revision: build.revision,
                  digest: build.manifest!.digest.slice(0, 19),
                })}
              </option>
            ))}
          </select>
        </label>
        {snapshot ? (
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <SnapshotRow
              label={t('releaseProductionEnvironment')}
              value={snapshot.environment.name}
            />
            <SnapshotRow
              label={t('releaseProductionVersion')}
              value={snapshot.releaseOrder.releaseVersion}
            />
            <SnapshotRow
              label={t('releaseProductionBuild')}
              value={`#${snapshot.build.revision} ${snapshot.build.sourceCommitSha}`}
            />
            <SnapshotRow
              label="Manifest"
              value={`${snapshot.manifest.id} / ${snapshot.manifest.digest}`}
            />
            <SnapshotRow
              label={t('releaseProductionConfig')}
              value={`r${snapshot.config.revision} / ${snapshot.config.snapshotHash}`}
            />
            <SnapshotRow
              label={t('releaseProductionPolicy')}
              value={JSON.stringify(snapshot.config.policySnapshot)}
            />
          </dl>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={!snapshot || production.confirming}
          />
          <span>{t('releaseProductionConfirmation')}</span>
        </label>
        <Button
          onClick={() => void production.confirm().then((run) => run && props.onChanged())}
          loading={production.confirming}
          disabled={!snapshot || !confirmed}
        >
          {t('requestProductionApproval')}
        </Button>
      </div>
      {production.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {production.error}
        </p>
      ) : null}
      <div className="space-y-3">
        {production.items.map((run) => (
          <article
            key={run.id}
            className="rounded-md border p-4 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong>{t('releaseProductionRun')}</strong>
              <StatusTag
                status={releaseOrderStatusTone(run.status)}
                label={run.status}
              />
              {run.operationApproval ? (
                <StatusTag
                  status={releaseOrderStatusTone(run.operationApproval.status)}
                  label={`${t('releaseProductionApproval')} ${run.operationApproval.status}`}
                />
              ) : null}
            </div>
            <p className="mt-2 break-all font-mono text-xs">Manifest {run.artifactManifestId}</p>
            <p className="mt-1 break-all font-mono text-xs">Digest {run.verifiedDigest}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded bg-muted/40 p-3">
      <dt className="font-medium">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{value}</dd>
    </div>
  );
}
