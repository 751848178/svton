'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/lib/format-date';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
  EnvironmentVersionItem,
} from '../../types/environment-version.types';
import { approvedEnvironmentVersionRun } from '../environment-version-card';
import { ReleaseOrderActions, type ReleaseTableAction } from '../release-order-actions';
import { releaseVersionIdentity } from '../../utils/release-version-display.model';
import {
  CandidateVersionStatus,
  CurrentEnvironmentVersion,
} from './environment-version-list-facts';
import { EnvironmentVersionRowDialog } from './environment-version-row-dialog';
import type { VersionPanelKind } from './environment-version-row-panels';
import { environmentVersionSwitchReasonKey } from './environment-version-switch-reason.model';

/** SET-1/2/4/14：行操作展开详情；窄屏隐藏证据列，避免表格叠印。 */
export function EnvironmentVersionList(props: {
  environment: EnvironmentVersionEnvironment;
  current?: EnvironmentVersionItem;
  candidates: EnvironmentVersionCandidate[];
  selectedId?: string;
  executing: boolean;
  onSelect: (candidate: EnvironmentVersionCandidate) => void;
  onSwitch: (
    candidate: EnvironmentVersionCandidate,
    restoreFocusTarget?: HTMLButtonElement,
  ) => void;
}) {
  const t = useTranslations('projects');
  const [expanded, setExpanded] = useState<{ id: string; panel: VersionPanelKind } | null>(null);
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const toggleExpand = (
    item: EnvironmentVersionCandidate,
    panel: VersionPanelKind,
    restoreFocusTarget?: HTMLButtonElement,
  ) => {
    if (restoreFocusTarget) restoreFocusRef.current = restoreFocusTarget;
    const alreadyOpen = expanded?.id === item.id && expanded.panel === panel;
    setExpanded(alreadyOpen ? null : { id: item.id, panel });
    props.onSelect(item);
  };
  return (
    <div className="space-y-5">
      <CurrentEnvironmentVersion current={props.current} />
      <div>
        <h4 className="mb-2 text-sm font-semibold">{t('environmentVersionExisting')}</h4>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] table-fixed text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-[16%] px-3 py-3 font-medium">{t('releaseVersionLabel')}</th>
                <th className="w-[18%] px-3 py-3 font-medium">{t('releaseOrderColumnSource')}</th>
                <th className="hidden w-[13%] px-3 py-3 font-medium 2xl:table-cell">
                  {t('environmentVersionEvidenceSummary')}
                </th>
                <th className="w-[22%] px-3 py-3 font-medium">
                  {t('environmentVersionCreatedAt')}
                </th>
                <th className="w-[16%] px-3 py-3 font-medium">{t('releaseOrderColumnStatus')}</th>
                <th className="w-[28%] px-3 py-3 text-right font-medium">
                  {t('releaseOrderColumnActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {props.candidates.map((item) => (
                <CandidateRow
                  key={item.id}
                  {...props}
                  item={item}
                  expandedPanel={expanded && expanded.id === item.id ? expanded.panel : null}
                  onExpand={(panel, trigger) => toggleExpand(item, panel, trigger)}
                />
              ))}
            </tbody>
          </table>
          {props.candidates.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              {t('environmentVersionNoCandidates')}
            </p>
          ) : null}
        </div>
      </div>
      <EnvironmentVersionRowDialog
        item={props.candidates.find((item) => item.id === expanded?.id)}
        panel={expanded?.panel}
        onClose={() => setExpanded(null)}
        restoreFocusRef={restoreFocusRef}
      />
    </div>
  );
}

function CandidateRow(
  props: Parameters<typeof EnvironmentVersionList>[0] & {
    item: EnvironmentVersionCandidate;
    expandedPanel: VersionPanelKind | null;
    onExpand: (panel: VersionPanelKind, restoreFocusTarget?: HTMLButtonElement) => void;
  },
) {
  const t = useTranslations('projects');
  const { item, environment, current } = props;
  const identity = releaseVersionIdentity(
    item.releaseOrder.releaseVersion,
    item.releaseOrder.releaseName,
  );
  const active = item.id === current?.artifactManifestId;
  const approved = Boolean(approvedEnvironmentVersionRun(item));
  const blocked = environment.baselineRole === 'production' && !approved;
  const disabled =
    active || blocked || props.executing || environment.targetReadiness.matchState !== 'ready';
  const actions: ReleaseTableAction[] = [
    {
      key: 'detail',
      label: t('viewVersionDetails'),
      onSelect: (trigger) => props.onExpand('detail', trigger),
    },
    {
      key: 'changes',
      label: t('viewVersionChanges'),
      onSelect: (trigger) => props.onExpand('changes', trigger),
    },
    {
      key: 'switch',
      label: t('switchToVersion'),
      onSelect: (trigger) => props.onSwitch(item, trigger),
      disabled,
    },
    {
      key: 'evidence',
      label: t('releaseOrderActionEvidence'),
      onSelect: (trigger) => props.onExpand('evidence', trigger),
    },
  ];
  const selected = props.selectedId === item.id;
  const version = identity.canonical
    ? identity.version
    : t('releaseLegacyVersionValue', { version: identity.version });
  const name =
    identity.name || (identity.canonical ? identity.version : t('releaseLegacyNameFallback'));
  return (
    <tr className={selected ? 'bg-primary/5' : 'hover:bg-muted/20'}>
      <td className="max-w-0 px-3 py-3">
        <p className="truncate font-semibold text-primary">{version}</p>
        {identity.name ? <p className="truncate text-xs text-muted-foreground">{name}</p> : null}
      </td>
      <td className="max-w-0 px-3 py-3">
        <p
          className="truncate font-mono text-xs"
          title={`${item.buildRun.sourceBranch} @ ${item.buildRun.sourceCommitSha.slice(0, 8)}`}
        >
          {item.buildRun.sourceBranch} @ {item.buildRun.sourceCommitSha.slice(0, 8)}
        </p>
      </td>
      <td className="hidden px-3 py-3 text-xs 2xl:table-cell">
        R{item.buildRun.revision} ·{' '}
        {t('environmentVersionEvidenceCount', {
          count: item.deploymentRuns.length,
        })}
      </td>
      <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">
        {formatDateTime(item.createdAt)}
      </td>
      <td className="px-3 py-3">
        <CandidateVersionStatus
          active={active}
          blocked={blocked}
        />
      </td>
      <td className="px-3 py-3 text-right">
        <ReleaseOrderActions
          actions={actions}
          moreLabel={t('releaseOrderMoreActions')}
          directCount={2}
        />
        {/* SET-3：切换禁用必须给出原因，不再让用户猜测。 */}
        {disabled ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t(
              environmentVersionSwitchReasonKey({
                active,
                blocked,
                readiness: environment.targetReadiness.matchState,
              }),
            )}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
