'use client';

import React, { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('projects');
  const dialogId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { catalog, loading, error, load } = useReleaseGateCatalog(projectId, releaseOrderId);

  if (loading && !catalog) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
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
        dialogId={dialogId}
        dialogOpen={dialogOpen}
        onOpenCatalog={() => setDialogOpen(true)}
      />
      <ReleaseGateCatalogDialog
        catalog={catalog}
        dialogId={dialogId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
