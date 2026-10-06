'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import type { ReleaseOrderListItem } from '../types/release-order-list.types';
import { releaseVersionIdentity } from '../utils/release-version-display.model';
import { basicReleaseStatus, basicReleaseStepLabelKey } from './release-basic-status.model';
import { ReleaseOrderActions, type ReleaseTableAction } from './release-order-actions';
import { PROJECT_COMPACT_ACTION_CLASS } from './project-workbench-surface';

export function ReleaseOrderListRow(props: { item: ReleaseOrderListItem; onOpen: () => void }) {
  const t = useTranslations('projects');
  const item = props.item;
  const identity = releaseVersionIdentity(item.releaseVersion, item.releaseName);
  const status = basicReleaseStatus(item.lifecycle, item.deployment.latest?.status);
  const actions: ReleaseTableAction[] = [
    { key: 'open', label: t('viewReleaseOrder'), onSelect: props.onOpen },
  ];
  return (
    <tr className="align-middle hover:bg-muted/20">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={props.onOpen}
          className={`${PROJECT_COMPACT_ACTION_CLASS} justify-start text-left font-semibold text-primary hover:underline`}
        >
          {/* REL-4：草稿在制品不得命名为「历史发布」。 */}
          {item.lifecycle.status === 'draft'
            ? t('releaseDraftTitlePrefix') +
              (identity.canonical
                ? identity.version
                : identity.name || t('releaseLegacyNameFallback'))
            : identity.canonical
              ? identity.version
              : identity.name || t('releaseLegacyNameFallback')}
        </button>
        {identity.name || !identity.canonical ? (
          <p className="mt-0.5 text-xs text-foreground">
            {identity.name || t('releaseLegacyVersionValue', { version: identity.version })}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <StatusTag
          status={status.tone}
          label={t(status.labelKey)}
        />
      </td>
      <td className="px-4 py-3 text-sm">{item.source.branch ?? '—'}</td>
      <td className="px-4 py-3">{t(basicReleaseStepLabelKey(item.lifecycle))}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatDateTime(item.lastExecutedAt)}
      </td>
      <td className="px-4 py-3">
        <ReleaseOrderActions
          actions={actions}
          moreLabel={t('releaseOrderMoreActions')}
        />
      </td>
    </tr>
  );
}
