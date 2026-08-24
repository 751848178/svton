'use client';

import React, { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { useReleaseGateCatalog } from '../hooks/use-release-gate-catalog';
import { ReleaseGateCatalogDialog } from './release-gate-catalog-dialog';
import { ReleaseGateSummary } from './release-gate-summary';

export function ReleaseGateCatalogPanel({
  projectId,
  releaseOrderId,
}: {
  projectId: string;
  releaseOrderId: string;
}) {
  const controller = useReleaseGateCatalog(projectId, releaseOrderId);
  return <ReleaseGateCatalogView controller={controller} />;
}

export function ReleaseGateCatalogView({
  controller,
  stage = 'build',
  stageLabel,
}: {
  controller: ReturnType<typeof useReleaseGateCatalog>;
  /** PX-1：计数口径 = 当前执行阶段决策；独立面板缺省 build。 */
  stage?: 'build' | 'staging' | 'production';
  stageLabel?: string;
}) {
  const t = useTranslations('projects');
  const dialogId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterCapabilityIds, setFilterCapabilityIds] = useState<readonly string[] | null>(null);
  const { catalog, loading, error, load, confirmManual, confirmingGateId, confirmationError } =
    controller;

  if (loading && !catalog) {
    return <LoadingState text={t('loading')} />;
  }

  if (!catalog) {
    return (
      <div
        role={error ? 'alert' : undefined}
        className="rounded-lg border p-4 text-sm"
      >
        <p className={error ? 'text-destructive' : 'text-muted-foreground'}>
          {error || t('releaseGateCatalogDescription')}
        </p>
        {error ? (
          <button
            type="button"
            className="mt-2 font-medium text-primary"
            onClick={() => void load()}
          >
            {t('retry')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <ReleaseGateSummary
        catalog={catalog}
        stage={stage}
        stageLabel={stageLabel || t('releaseOrderStepBuild')}
        dialogId={dialogId}
        dialogOpen={dialogOpen}
        onOpenCatalog={(capabilityIds) => {
          setFilterCapabilityIds(capabilityIds ?? null);
          setDialogOpen(true);
        }}
        onRefresh={() => void load()}
        refreshing={loading}
      />
      <ReleaseGateCatalogDialog
        catalog={catalog}
        dialogId={dialogId}
        open={dialogOpen}
        filterCapabilityIds={filterCapabilityIds}
        confirmingGateId={confirmingGateId}
        confirmationError={confirmationError}
        onConfirmManual={confirmManual}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
