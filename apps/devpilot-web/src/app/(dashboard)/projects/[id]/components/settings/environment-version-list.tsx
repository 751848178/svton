'use client';

import React, { useState } from 'react';
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
import { VersionRowPanel, type VersionPanelKind } from './environment-version-row-panels';

/**
 * 已有版本表（SET-1/SET-2/SET-4/SET-14）：
 * - 行内「详情/变更/技术证据」操作展开对应面板，保证点击有可见反馈；
 * - 版本号与名称合并为一列、发布证据列在 2xl 以下隐藏，1280px 不再叠印。
 */
export function EnvironmentVersionList(props: {
  environment: EnvironmentVersionEnvironment;
  current?: EnvironmentVersionItem;
  candidates: EnvironmentVersionCandidate[];
  selectedId?: string;
  executing: boolean;
  onSelect: (candidate: EnvironmentVersionCandidate) => void;
  onSwitch: (candidate: EnvironmentVersionCandidate) => void;
}) {
  const t = useTranslations('projects');
  const [expanded, setExpanded] = useState<{ id: string; panel: VersionPanelKind } | null>(null);
  const toggleExpand = (item: EnvironmentVersionCandidate, panel: VersionPanelKind) => {
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
                <th className="w-[24%] px-3 py-3 font-medium">{t('releaseVersionLabel')}</th>
                <th className="w-[24%] px-3 py-3 font-medium">{t('releaseOrderColumnSource')}</th>
                <th className="hidden w-[13%] px-3 py-3 font-medium 2xl:table-cell">
                  {t('environmentVersionEvidenceSummary')}
                </th>
                <th className="w-[15%] px-3 py-3 font-medium">{t('environmentVersionCreatedAt')}</th>
                <th className="w-[10%] px-3 py-3 font-medium">{t('releaseOrderColumnStatus')}</th>
                <th className="w-[27%] px-3 py-3 text-right font-medium">
                  {t('releaseOrderColumnActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {props.candidates.map((item) => (
                <React.Fragment key={item.id}>
                  <CandidateRow
                    {...props}
                    item={item}
                    expandedPanel={
                      expanded && expanded.id === item.id ? expanded.panel : null
                    }
                    onExpand={(panel) => toggleExpand(item, panel)}
                  />
                  {expanded?.id === item.id ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 pb-4 pt-0"
                      >
                        <VersionRowPanel
                          item={item}
                          panel={expanded.panel}
                        />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
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
    </div>
  );
}

function CandidateRow(
  props: Parameters<typeof EnvironmentVersionList>[0] & {
    item: EnvironmentVersionCandidate;
    expandedPanel: VersionPanelKind | null;
    onExpand: (panel: VersionPanelKind) => void;
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
      onSelect: () => props.onExpand('detail'),
    },
    {
      key: 'changes',
      label: t('viewVersionChanges'),
      onSelect: () => props.onExpand('changes'),
    },
    { key: 'switch', label: t('switchToVersion'), onSelect: () => props.onSwitch(item), disabled },
    {
      key: 'evidence',
      label: t('releaseOrderActionEvidence'),
      onSelect: () => props.onExpand('evidence'),
    },
  ];
  const selected = props.selectedId === item.id;
  const version = identity.canonical
    ? identity.version
    : t('releaseLegacyVersionValue', { version: identity.version });
  const name = identity.name || (identity.canonical ? identity.version : t('releaseLegacyNameFallback'));
  return (
    <tr className={selected ? 'bg-primary/5' : 'hover:bg-muted/20'}>
      <td className="max-w-0 px-3 py-3">
        <p className="truncate font-semibold text-primary">{version}</p>
        <p className="truncate text-xs text-muted-foreground">{name}</p>
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
        />
        {/* SET-3：切换禁用必须给出原因，不再让用户猜测。 */}
        {disabled ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t(switchDisabledReasonKey({ active, blocked, readiness: environment.targetReadiness.matchState }))}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

function switchDisabledReasonKey(input: {
  active: boolean;
  blocked: boolean;
  readiness: string;
}): string {
  if (input.active) return 'envVersionSwitchDisabledActive';
  if (input.blocked) return 'envVersionSwitchDisabledApproval';
  if (input.readiness !== 'ready') return 'envVersionSwitchDisabledReadiness';
  return 'envVersionSwitchDisabledExecuting';
}
