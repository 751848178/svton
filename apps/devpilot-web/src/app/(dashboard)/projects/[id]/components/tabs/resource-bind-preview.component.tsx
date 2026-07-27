'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { ConfirmDialog } from '@/components/ui';
import type { EnvironmentResourceBulkBindResult } from '../../types/environment-copy';

export function ResourceBindPreview({
  preview,
  environmentName,
  applying,
  onApply,
}: {
  preview: EnvironmentResourceBulkBindResult;
  environmentName: string;
  applying: boolean;
  onApply: () => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <div>
        <p className="text-sm font-medium">
          {t('bindPreviewSummary', { count: preview.plannedCount, environment: environmentName })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('bindPreviewNoChanges')}</p>
      </div>
      <ul className="max-h-40 space-y-1 overflow-auto text-xs">
        {preview.steps.map((step) => (
          <li
            key={`${step.type}:${step.resourceId}`}
            className="rounded bg-background px-2 py-1.5"
          >
            <span className="font-medium">{step.title}</span>
            <span className="ml-2 text-muted-foreground">{step.description}</span>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={preview.plannedCount === 0}
        loading={applying}
      >
        {t('bindApplyAction')}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="warning"
        title={t('bindApplyTitle')}
        description={t('bindApplyDescription', {
          count: preview.plannedCount,
          environment: environmentName,
        })}
        resourceName={environmentName}
        confirmLabel={t('bindApplyAction')}
        onConfirm={onApply}
      />
    </div>
  );
}
