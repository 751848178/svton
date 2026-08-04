'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { ReleaseOrderListStatus } from '../types/release-order-list.types';

export function ReleaseOrderListToolbar({
  query,
  status,
  total,
  onQueryChange,
  onStatusChange,
}: {
  query: string;
  status: ReleaseOrderListStatus | null;
  total: number;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: ReleaseOrderListStatus | null) => void;
}) {
  const t = useTranslations('projects');
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
        <label className="min-w-[260px] flex-1 text-sm">
          <span className="sr-only">{t('releaseOrderSearchLabel')}</span>
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('releaseOrderSearchPlaceholder')}
            aria-label={t('releaseOrderSearchLabel')}
            maxLength={200}
          />
        </label>
        <label className="w-full text-sm sm:w-48">
          <span className="sr-only">{t('releaseOrderStatusFilterLabel')}</span>
          <Select
            value={status ?? ''}
            onChange={(event) =>
              onStatusChange((event.target.value || null) as ReleaseOrderListStatus | null)
            }
            aria-label={t('releaseOrderStatusFilterLabel')}
            options={[
              { value: '', label: t('releaseOrderStatusAll') },
              { value: 'draft', label: t('releaseOrderStatusDraft') },
              { value: 'active', label: t('releaseOrderStatusActive') },
              { value: 'succeeded', label: t('releaseOrderStatusSucceeded') },
              { value: 'failed', label: t('releaseOrderStatusFailed') },
              { value: 'canceled', label: t('releaseOrderStatusCanceled') },
            ]}
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('releaseOrderListSummary', { count: total })}
      </p>
    </div>
  );
}
