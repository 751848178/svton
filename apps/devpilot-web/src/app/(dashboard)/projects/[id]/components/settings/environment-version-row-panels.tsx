/**
 * 版本行内展开面板（SET-1/SET-2/SET-4）。
 *
 * 单一职责：为「已有版本」表格行提供 详情 / 变更 / 技术证据 三种展开内容。
 * 行操作点击后在此展开，保证按钮始终产生可见反馈；技术 ID 一律折叠展示。
 */
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/lib/format-date';
import type { EnvironmentVersionCandidate } from '../../types/environment-version.types';
import { releaseVersionIdentity } from '../../utils/release-version-display.model';

export type VersionPanelKind = 'detail' | 'changes' | 'evidence';

export function VersionRowPanel(props: {
  item: EnvironmentVersionCandidate;
  panel: VersionPanelKind;
}) {
  if (props.panel === 'changes') return <VersionChangesPanel item={props.item} />;
  if (props.panel === 'evidence') return <VersionEvidencePanel item={props.item} />;
  return <VersionDetailPanel item={props.item} />;
}

function PanelShell(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 bg-muted/20 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {props.title}
      </p>
      {props.children}
    </div>
  );
}

function PanelFact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <span
        className={`${props.mono ? 'font-mono text-xs' : 'text-sm'} font-medium`}
      >
        {props.value}
      </span>
    </div>
  );
}

function sourceText(item: EnvironmentVersionCandidate) {
  return `${item.buildRun.sourceBranch} @ ${item.buildRun.sourceCommitSha.slice(0, 8)}`;
}

/** SET-1 查看详情：版本事实一屏展开，替代“点了没反应”的隐式侧栏选中。 */
function VersionDetailPanel({ item }: { item: EnvironmentVersionCandidate }) {
  const t = useTranslations('projects');
  const identity = releaseVersionIdentity(
    item.releaseOrder.releaseVersion,
    item.releaseOrder.releaseName,
  );
  return (
    <PanelShell title={t('environmentVersionDetailPanelTitle')}>
      <div className="space-y-2">
        <PanelFact
          label={t('releaseVersionLabel')}
          value={
            identity.canonical
              ? identity.version
              : t('releaseLegacyVersionValue', { version: identity.version })
          }
        />
        <PanelFact
          label={t('releaseNameLabel')}
          value={identity.name || '—'}
        />
        <PanelFact
          label={t('releaseOrderColumnSource')}
          value={sourceText(item)}
          mono
        />
        <PanelFact
          label={t('environmentVersionBuildRevision')}
          value={`R${item.buildRun.revision}`}
        />
        <PanelFact
          label={t('environmentVersionStagingEvidence')}
          value={t('environmentVersionEvidenceCount', { count: item.deploymentRuns.length })}
        />
        <PanelFact
          label={t('environmentVersionCreatedAt')}
          value={formatDateTime(item.createdAt)}
        />
      </div>
    </PanelShell>
  );
}

/** SET-2 查看变更：展示变更来源与构建修订；无组件/配置明细时给出明确说明而非静默。 */
function VersionChangesPanel({ item }: { item: EnvironmentVersionCandidate }) {
  const t = useTranslations('projects');
  return (
    <PanelShell title={t('environmentVersionChangesPanelTitle')}>
      <div className="space-y-2">
        <PanelFact
          label={t('releaseOrderColumnSource')}
          value={sourceText(item)}
          mono
        />
        <PanelFact
          label={t('environmentVersionBuildRevision')}
          value={`R${item.buildRun.revision}`}
        />
      </div>
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t('environmentVersionChangesNoDetail')}
      </p>
    </PanelShell>
  );
}

/** SET-4 技术证据：证据计数直接可见，底层 ID（manifest/构建/部署/发布运行）折叠。 */
function VersionEvidencePanel({ item }: { item: EnvironmentVersionCandidate }) {
  const t = useTranslations('projects');
  return (
    <PanelShell title={t('environmentVersionEvidencePanelTitle')}>
      <div className="space-y-2">
        <PanelFact
          label={t('environmentVersionStagingEvidence')}
          value={t('environmentVersionEvidenceCount', { count: item.deploymentRuns.length })}
        />
        <PanelFact
          label={t('environmentVersionReleaseRunEvidence')}
          value={t('environmentVersionEvidenceCount', { count: item.releaseRuns.length })}
        />
      </div>
      <details className="rounded-md border">
        <summary className="min-h-9 cursor-pointer px-3 py-2 text-xs font-medium">
          {t('environmentVersionTechnicalIds')}
        </summary>
        <dl className="space-y-1.5 border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <TechId label="manifest" value={item.id} />
          <TechId label="digest" value={item.digest} />
          <TechId label="buildRun" value={item.buildRun.id} />
          {item.deploymentRuns.map((run) => (
            <TechId
              key={run.id}
              label="deploymentRun"
              value={run.id}
            />
          ))}
          {item.releaseRuns.map((run) => (
            <TechId
              key={run.id}
              label={`releaseRun${run.operationApproval ? ` · ${run.operationApproval.status}` : ''}`}
              value={run.id}
            />
          ))}
        </dl>
      </details>
    </PanelShell>
  );
}

function TechId(props: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      <dt className="min-w-28">{props.label}</dt>
      <dd className="break-all">{props.value}</dd>
    </div>
  );
}
