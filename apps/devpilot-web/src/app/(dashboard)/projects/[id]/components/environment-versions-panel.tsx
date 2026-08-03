'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, LinkButton, StatusTag } from '@/components/ui';
import { useEnvironmentVersions } from '../hooks/use-environment-versions';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
} from '../types/environment-version.types';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentVersionsPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const project = detail.project;
  const versions = useEnvironmentVersions(project?.id || '');
  const [selection, setSelection] = useState<Record<string, string>>({});
  if (!project) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('environmentVersionsDescription')}</p>
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
          const selectedId = selection[environment.id] || versions.candidates[0]?.id || '';
          const candidate = versions.candidates.find((item) => item.id === selectedId);
          const releaseRunId = approvedRun(candidate);
          return (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              candidates={versions.candidates}
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
              onRecovery={(sourceVersionId, manifestId) =>
                versions.execute(environment.id, {
                  kind: 'recovery',
                  sourceVersionId,
                  releaseRunId:
                    environment.baselineRole === 'production'
                      ? approvedRun(versions.candidates.find((item) => item.id === manifestId))
                      : undefined,
                })
              }
            />
          );
        })}
      </div>
      <LinkButton
        href={`/projects/${encodeURIComponent(project.id)}/settings?section=environments`}
        variant="outline"
      >
        {t('manageEnvironmentConfiguration')}
      </LinkButton>
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
  onRecovery: (sourceVersionId: string, manifestId: string) => unknown;
}) {
  const t = useTranslations('projects');
  const env = props.environment;
  const current = env.environmentVersions.find(
    (item) => item.id === env.currentEnvironmentVersionId,
  );
  return (
    <article className="space-y-4 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          {env.baselineRole === 'staging' ? 'Staging' : 'Production'}
        </h2>
        <StatusTag
          status={current ? 'success' : 'default'}
          label={current ? t('environmentVersionCurrent') : t('environmentVersionUnavailable')}
        />
      </div>
      {current ? (
        <VersionSummary version={current} />
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
          >
            {props.candidates.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
              >
                {candidate.releaseOrder.releaseVersion} · Build #{candidate.buildRun.revision}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={props.onUpgrade}
          loading={props.executing}
          disabled={!props.selectedId || props.productionBlocked}
        >
          {t('environmentVersionUpgrade')}
        </Button>
      </div>
      {props.productionBlocked ? (
        <p className="text-xs text-amber-700">
          {t('environmentVersionProductionApprovalRequired')}
        </p>
      ) : null}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('environmentVersionHistory')}</h3>
        {env.environmentVersions.map((version) => (
          <div
            key={version.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-xs"
          >
            <VersionSummary version={version} />
            {version.id !== env.currentEnvironmentVersionId ? (
              <Button
                variant="outline"
                size="sm"
                disabled={
                  props.executing ||
                  (env.baselineRole === 'production' &&
                    !approvedRun(
                      props.candidates.find((item) => item.id === version.artifactManifestId),
                    ))
                }
                onClick={() => props.onRecovery(version.id, version.artifactManifestId)}
              >
                {t('environmentVersionRecover')}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function VersionSummary({
  version,
}: {
  version: EnvironmentVersionEnvironment['environmentVersions'][number];
}) {
  return (
    <div className="min-w-0">
      <p className="font-medium">
        {version.releaseOrder.releaseVersion} · {version.kind}
      </p>
      <p className="break-all font-mono text-muted-foreground">
        Build #{version.artifactManifest.buildRun.revision} · {version.artifactManifest.digest}
      </p>
    </div>
  );
}

function approvedRun(candidate?: EnvironmentVersionCandidate) {
  return candidate?.releaseRuns.find(
    (run) => run.operationApproval?.status === 'approved' && !run.operationApproval.consumedAt,
  )?.id;
}
