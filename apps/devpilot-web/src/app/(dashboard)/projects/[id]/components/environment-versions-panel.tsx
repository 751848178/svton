'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, LinkButton, StatusTag } from '@/components/ui';
import { useEnvironmentVersions } from '../hooks/use-environment-versions';
import type { RecoveryCreateResult } from '../hooks/use-recovery-confirm';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
  EnvironmentVersionItem,
} from '../types/environment-version.types';
import { environmentVersionKindLabelKey } from '../utils/release-copy.model';
import { releaseOrderHref } from '../utils/project-route.utils';
import { formatIso } from '../utils/release-time.utils';
import { EnvironmentRecoveryDialog } from './environment-recovery-dialog';
import { EnvironmentVersionSummary } from './environment-version-summary';

interface RecoveryTarget {
  environment: EnvironmentVersionEnvironment;
  sourceVersionId: string;
}

export function EnvironmentVersionsPanel({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const versions = useEnvironmentVersions(projectId);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [recoveryTarget, setRecoveryTarget] = useState<RecoveryTarget | null>(null);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('environmentVersionPageTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('environmentVersionsDescription')}</p>
        </div>
        <StatusTag
          status="success"
          label={t('environmentVersionEnvironmentCount', {
            count: versions.environments.length,
          })}
        />
      </div>
      {versions.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {versions.error}
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {versions.environments.map((environment) => {
          const candidates = versions.candidates[environment.baselineRole] ?? [];
          const selectedId = selection[environment.id] || candidates[0]?.id || '';
          const candidate = candidates.find((item) => item.id === selectedId);
          const releaseRunId = approvedRun(candidate);
          return (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              candidates={candidates}
              selectedId={selectedId}
              executing={versions.executing}
              productionBlocked={environment.baselineRole === 'production' && !releaseRunId}
              onSelect={(id) => setSelection((current) => ({ ...current, [environment.id]: id }))}
              onUpgrade={() =>
                versions.execute(environment.id, {
                  kind: 'upgrade',
                  manifestId: selectedId,
                  releaseRunId:
                    environment.baselineRole === 'production' ? releaseRunId : undefined,
                })
              }
              onRecovery={(sourceVersionId) =>
                setRecoveryTarget({ environment, sourceVersionId })
              }
            />
          );
        })}
      </div>
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t('environmentVersionProductionCallout')}
      </p>
      <section className="rounded-lg border">
        <div className="border-b p-4">
          <h3 className="font-semibold">{t('environmentVersionChangeLog')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('environmentVersionChangeLogHelper')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed text-sm">
            <caption className="border-b bg-muted/40 px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              {t('environmentVersionChangeLogCaption')}
            </caption>
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="w-[14%] px-4 py-2 font-medium">{t('environmentVersionColumnEnvironment')}</th>
                <th scope="col" className="w-[10%] px-4 py-2 font-medium">{t('environmentVersionColumnAction')}</th>
                <th scope="col" className="w-[20%] px-4 py-2 font-medium">{t('environmentVersionColumnVersionChange')}</th>
                <th scope="col" className="w-[22%] px-4 py-2 font-medium">{t('environmentVersionColumnArtifact')}</th>
                <th scope="col" className="w-[14%] px-4 py-2 font-medium">{t('environmentVersionColumnResult')}</th>
                <th scope="col" className="w-[20%] px-4 py-2 font-medium">{t('environmentVersionColumnTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {versions.environments.flatMap((environment) =>
                environment.environmentVersions.map((version) => (
                  <EnvironmentChangeRow
                    key={version.id}
                    environment={environment}
                    version={version}
                  />
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <LinkButton
        href={`/projects/${encodeURIComponent(projectId)}/settings?section=environments`}
        variant="outline"
      >
        {t('manageEnvironmentConfiguration')}
      </LinkButton>
      {recoveryTarget ? (
        <EnvironmentRecoveryDialog
          projectId={projectId}
          environment={recoveryTarget.environment}
          defaultSourceVersionId={recoveryTarget.sourceVersionId}
          onClose={() => setRecoveryTarget(null)}
          onConfirmed={
            recoveryTarget.environment.baselineRole === 'production'
              ? (result: RecoveryCreateResult, sourceVersionId: string) => {
                  setRecoveryTarget(null);
                  router.push(
                    releaseOrderHref(
                      projectId,
                      result.preview.snapshot.releaseOrder.id,
                      'production',
                      searchParams,
                      { releaseRunId: result.run.id },
                    ),
                  );
                }
              : undefined
          }
          onDirectConfirm={
            recoveryTarget.environment.baselineRole === 'production'
              ? undefined
              : async (sourceVersionId: string) => {
                  await versions.execute(recoveryTarget.environment.id, {
                    kind: 'recovery',
                    sourceVersionId,
                  });
                }
          }
        />
      ) : null}
    </div>
  );
}

function EnvironmentCard(props: {
  environment: EnvironmentVersionEnvironment;
  candidates: EnvironmentVersionCandidate[];
  selectedId: string;
  executing: boolean;
  productionBlocked: boolean;
  onSelect: (id: string) => void;
  onUpgrade: () => unknown;
  onRecovery: (sourceVersionId: string) => unknown;
}) {
  const t = useTranslations('projects');
  const env = props.environment;
  const production = env.baselineRole === 'production';
  const current = env.environmentVersions.find(
    (item) => item.id === env.currentEnvironmentVersionId,
  );
  const previous = current
    ? env.environmentVersions.find((item) => item.id === current.previousVersionId)
    : null;
  return (
    <article className="space-y-4 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{env.name}</h3>
        {current ? (
          <StatusTag
            status="success"
            label={t('environmentVersionDeployedBadge')}
          />
        ) : (
          <StatusTag
            status="default"
            label={t('environmentVersionUnavailable')}
          />
        )}
      </div>
      {current ? (
        <EnvironmentVersionSummary version={current} />
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('environmentVersionUnavailableDescription')}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 p-3">
        <label className="min-w-56 flex-1 text-sm">
          <span className="mb-1 block font-medium">{t('environmentVersionUpgradeTarget')}</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={props.selectedId}
            onChange={(event) => props.onSelect(event.target.value)}
            disabled={props.candidates.length === 0}
          >
            {props.candidates.length === 0 ? (
              <option value="">{t('environmentVersionNoCandidates')}</option>
            ) : (
              props.candidates.map((candidate) => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                >
                  {t('environmentVersionCandidateOption', {
                    version: candidate.releaseOrder.releaseVersion,
                    revision: candidate.buildRun.revision,
                  })}
                  {production ? t('environmentVersionCandidateProductionSuffix') : ''}
                </option>
              ))
            )}
          </select>
        </label>
        <Button
          onClick={props.onUpgrade}
          loading={props.executing}
          disabled={!props.selectedId || props.productionBlocked}
        >
          {t('environmentVersionUpgradeShort')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={props.executing || !previous}
          onClick={() =>
            previous ? props.onRecovery(previous.id) : undefined
          }
        >
          {t('environmentVersionRollback')}
        </Button>
        {props.productionBlocked ? (
          <p className="text-xs text-amber-800">
            {t('environmentVersionProductionApprovalRequired')}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function EnvironmentChangeRow(props: {
  environment: EnvironmentVersionEnvironment;
  version: EnvironmentVersionItem;
}) {
  const t = useTranslations('projects');
  const { environment, version } = props;
  const previous = environment.environmentVersions.find(
    (item) => item.id === version.previousVersionId,
  );
  const current = version.id === environment.currentEnvironmentVersionId;
  return (
    <tr>
      <th scope="row" className="px-4 py-3 text-left font-medium">{environment.name}</th>
      <td className="px-4 py-3">{t(environmentVersionKindLabelKey(version.kind))}</td>
      <td className="px-4 py-3 font-mono">
        {previous
          ? `${previous.releaseOrder.releaseVersion} → ${version.releaseOrder.releaseVersion}`
          : version.releaseOrder.releaseVersion}
      </td>
      <td className="px-4 py-3 font-mono">{shortManifest(version.artifactManifest.id)}</td>
      <td className="px-4 py-3">
        {current ? (
          <StatusTag
            status="success"
            label={t('environmentVersionResultSuccess')}
          />
        ) : (
          <StatusTag
            status="default"
            label={t('environmentVersionResultHistory')}
          />
        )}
      </td>
      <td className="px-4 py-3">{formatIso(version.effectiveAt)}</td>
    </tr>
  );
}

function shortManifest(id: string) {
  return id.length > 14 ? `${id.slice(0, 12)}…` : id;
}

function approvedRun(candidate?: EnvironmentVersionCandidate) {
  return candidate?.releaseRuns.find(
    (run) => run.operationApproval?.status === 'approved' && !run.operationApproval.consumedAt,
  )?.id;
}
