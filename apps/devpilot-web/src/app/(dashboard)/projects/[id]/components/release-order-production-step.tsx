'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { Button, ErrorBanner } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import { useProductionReleases } from '../hooks/use-production-releases';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import {
  releaseClientErrorLabelKey,
  releaseEnvironmentValueLabelKey,
} from '../utils/release-copy.model';
import { ReleaseProductionEvidenceList } from './release-production-evidence-list';

interface Props {
  projectId: string;
  releaseOrderId: string;
  onChanged: () => Promise<unknown>;
  evidence: ReleaseOrderEvidenceHook;
  focusedReleaseRunId?: string;
  focusedDeploymentRunId?: string;
  onFocus: (releaseRunId: string, deploymentRunId?: string) => void;
}

export function ReleaseOrderProductionStep(props: Props) {
  const t = useTranslations('projects');
  const builds = useReleaseBuilds(props.projectId, props.releaseOrderId, props.onChanged);
  const staging = useReleaseStagingDeployments(props.projectId, props.releaseOrderId);
  const evidence = props.evidence.evidence;
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
  const production = useProductionReleases(
    props.projectId,
    props.releaseOrderId,
    manifestId,
    props.onChanged,
  );
  const snapshot = production.preview?.snapshot;
  const snapshotEnvironmentKey = releaseEnvironmentValueLabelKey(snapshot?.environment.name);
  const productionErrorKey = releaseClientErrorLabelKey(production.error);
  const stagingErrorKey = releaseClientErrorLabelKey(staging.error);

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
            disabled={builds.loading || staging.loading || production.confirming}
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
              value={snapshotEnvironmentKey ? t(snapshotEnvironmentKey) : snapshot.environment.name}
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
              value={`${snapshot.releasePolicy.synthetic ? t('releasePolicySynthetic') : `R${snapshot.releasePolicy.revision}`} / ${t('releasePolicyStrategyStandard')} / ${snapshot.releasePolicy.snapshotHash}`}
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
          onClick={() => void production.confirm()}
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
          {productionErrorKey ? t(productionErrorKey) : production.error}
        </p>
      ) : null}
      {builds.error ? (
        <ErrorBanner
          message={builds.error}
          onRetry={builds.load}
        />
      ) : null}
      {staging.error ? (
        <ErrorBanner
          message={stagingErrorKey ? t(stagingErrorKey) : staging.error}
          onRetry={staging.load}
        />
      ) : null}
      {props.evidence.error ? (
        <ErrorBanner
          message={props.evidence.error}
          onRetry={props.evidence.load}
        />
      ) : null}
      {props.evidence.loading && !evidence ? <LoadingState /> : null}
      {!props.evidence.loading && evidence?.productionReleaseRuns.items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t('releaseStepProductionEmpty')}
        </p>
      ) : null}
      {evidence ? (
        <ReleaseProductionEvidenceList
          projectId={props.projectId}
          items={evidence.productionReleaseRuns.items}
          total={evidence.productionReleaseRuns.total}
          focusedReleaseRunId={props.focusedReleaseRunId}
          focusedDeploymentRunId={props.focusedDeploymentRunId}
          onFocus={props.onFocus}
        />
      ) : null}
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
