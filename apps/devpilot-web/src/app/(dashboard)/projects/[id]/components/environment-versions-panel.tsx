'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ErrorBanner, LinkButton } from '@/components/ui';
import { useEnvironmentVersions } from '../hooks/use-environment-versions';
import type { RecoveryCreateResult } from '../hooks/use-recovery-confirm';
import type { EnvironmentVersionEnvironment } from '../types/environment-version.types';
import { releaseOrderHref } from '../utils/project-route.utils';
import { EnvironmentChangeRow } from './environment-change-row';
import { EnvironmentRecoveryDialog } from './environment-recovery-dialog';
import { approvedEnvironmentVersionRun, EnvironmentVersionCard } from './environment-version-card';
import { EnvironmentVersionsHeader } from './environment-versions-header';
import { EnvironmentVersionsRequestState } from './environment-versions-request-state';

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
  const hasEnvironments = versions.environments.length > 0;
  if (versions.loading || !hasEnvironments) {
    return (
      <div className="space-y-5">
        <EnvironmentVersionsHeader />
        <EnvironmentVersionsRequestState
          projectId={projectId}
          loading={versions.loading}
          error={versions.error}
          onRetry={() => void versions.load()}
        />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <EnvironmentVersionsHeader count={versions.environments.length} />
      {versions.error ? (
        <ErrorBanner
          message={versions.error}
          onRetry={() => void versions.load()}
          retryLabel={t('environmentVersionsRetry')}
        />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {versions.environments.map((environment) => {
          const candidates = versions.candidates[environment.baselineRole] ?? [];
          const selectedId = selection[environment.id] || candidates[0]?.id || '';
          const candidate = candidates.find((item) => item.id === selectedId);
          const releaseRunId = approvedEnvironmentVersionRun(candidate);
          return (
            <EnvironmentVersionCard
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
              onRecovery={(sourceVersionId) => setRecoveryTarget({ environment, sourceVersionId })}
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
          <p className="text-xs text-muted-foreground">{t('environmentVersionChangeLogHelper')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed text-sm">
            <caption className="border-b bg-muted/40 px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              {t('environmentVersionChangeLogCaption')}
            </caption>
            <thead className="bg-muted/50 text-left">
              <tr>
                <th
                  scope="col"
                  className="w-[14%] px-4 py-2 font-medium"
                >
                  {t('environmentVersionColumnEnvironment')}
                </th>
                <th
                  scope="col"
                  className="w-[10%] px-4 py-2 font-medium"
                >
                  {t('environmentVersionColumnAction')}
                </th>
                <th
                  scope="col"
                  className="w-[20%] px-4 py-2 font-medium"
                >
                  {t('environmentVersionColumnVersionChange')}
                </th>
                <th
                  scope="col"
                  className="w-[22%] px-4 py-2 font-medium"
                >
                  {t('environmentVersionColumnArtifact')}
                </th>
                <th
                  scope="col"
                  className="w-[14%] px-4 py-2 font-medium"
                >
                  {t('environmentVersionColumnResult')}
                </th>
                <th
                  scope="col"
                  className="w-[20%] px-4 py-2 font-medium"
                >
                  {t('environmentVersionColumnTime')}
                </th>
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
