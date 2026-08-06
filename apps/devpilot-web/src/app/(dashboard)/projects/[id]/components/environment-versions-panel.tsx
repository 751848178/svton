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
} from '../types/environment-version.types';
import { releaseEnvironmentLabelKey } from '../utils/release-copy.model';
import { releaseOrderHref } from '../utils/project-route.utils';
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
              onRecovery={(sourceVersionId) =>
                versions.execute(environment.id, {
                  kind: 'recovery',
                  sourceVersionId,
                })
              }
              onProductionRecovery={(sourceVersionId) =>
                setRecoveryTarget({ environment, sourceVersionId })
              }
            />
          );
        })}
      </div>
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
          onConfirmed={(result: RecoveryCreateResult, sourceVersionId: string) => {
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
          }}
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
  onProductionRecovery: (sourceVersionId: string) => unknown;
}) {
  const t = useTranslations('projects');
  const env = props.environment;
  const current = env.environmentVersions.find(
    (item) => item.id === env.currentEnvironmentVersionId,
  );
  return (
    <article className="space-y-4 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t(releaseEnvironmentLabelKey(env.baselineRole))}</h2>
        <StatusTag
          status={current ? 'success' : 'default'}
          label={current ? t('environmentVersionCurrent') : t('environmentVersionUnavailable')}
        />
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
          >
            {props.candidates.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
              >
                {t('environmentVersionCandidateOption', {
                  version: candidate.releaseOrder.releaseVersion,
                  revision: candidate.buildRun.revision,
                })}
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
            <EnvironmentVersionSummary version={version} />
            {version.id !== env.currentEnvironmentVersionId ? (
              env.baselineRole === 'production' ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={props.executing}
                  onClick={() => props.onProductionRecovery(version.id)}
                >
                  {t('environmentVersionRecover')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={props.executing}
                  onClick={() => props.onRecovery(version.id)}
                >
                  {t('environmentVersionRecover')}
                </Button>
              )
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function approvedRun(candidate?: EnvironmentVersionCandidate) {
  return candidate?.releaseRuns.find(
    (run) => run.operationApproval?.status === 'approved' && !run.operationApproval.consumedAt,
  )?.id;
}
