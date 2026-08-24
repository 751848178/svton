'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import type { ReleaseOrderListItem } from '../types/release-order-list.types';
import { releaseOrderStatusLabelKey } from '../utils/release-copy.model';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { releaseVersionIdentity } from '../utils/release-version-display.model';
import { ReleaseOrderActions, type ReleaseTableAction } from './release-order-actions';

export function ReleaseOrderListRow(props: {
  item: ReleaseOrderListItem;
  onOpen: () => void;
  onOpenBuild?: () => void;
  onOpenDeployment?: () => void;
  onOpenEvidence?: () => void;
}) {
  const t = useTranslations('projects');
  const item = props.item;
  const identity = releaseVersionIdentity(item.releaseVersion, item.releaseName);
  const actions: ReleaseTableAction[] = [
    { key: 'detail', label: t('viewReleaseOrder'), onSelect: props.onOpen },
  ];
  if (item.source.buildRunId)
    actions.push({
      key: 'build',
      label: t('releaseOrderActionBuild'),
      onSelect: props.onOpenBuild ?? props.onOpen,
    });
  if (item.deployment.latest)
    actions.push({
      key: 'deployment',
      label: t('releaseOrderActionDeployment'),
      onSelect: props.onOpenDeployment ?? props.onOpen,
    });
  if (item.build.recentSuccessfulManifest)
    actions.push({
      key: 'evidence',
      label: t('releaseOrderActionEvidence'),
      onSelect: props.onOpenEvidence ?? props.onOpen,
    });
  return (
    <tr className="align-middle hover:bg-muted/20">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={props.onOpen}
          className="text-left font-semibold text-primary hover:underline"
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
        <p className="mt-0.5 text-xs text-foreground">
          {identity.canonical
            ? identity.name || identity.version
            : t('releaseLegacyVersionValue', { version: identity.version })}
        </p>
        {/* REL-2：发布单号明确标注「发布单 #短号」，完整 ID 折叠进 title，
            不再裸露整串 cuid 让人误当 commit。 */}
        <button
          type="button"
          onClick={props.onOpen}
          className="mt-0.5 block max-w-44 truncate font-mono text-[11px] text-muted-foreground hover:text-primary"
          title={item.id}
        >
          {t('releaseOrderShortId', { id: item.id.slice(0, 8) })}
        </button>
      </td>
      <td className="px-4 py-3">
        <StatusTag
          status={releaseOrderStatusTone(item.lifecycle.status)}
          label={t(releaseOrderStatusLabelKey(item.lifecycle.status))}
        />
      </td>
      <td className="px-4 py-3 font-mono text-xs">
        {item.source.commitSha
          ? `${item.source.branch ?? '—'} @ ${item.source.commitSha.slice(0, 8)}`
          : (item.source.branch ?? '—')}
      </td>
      <td className="px-4 py-3">
        {t(`releaseOrderListStep${capitalize(item.lastExecution.step)}`)}
      </td>
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

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
