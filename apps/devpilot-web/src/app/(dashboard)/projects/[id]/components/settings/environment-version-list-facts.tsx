'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { EnvironmentVersionItem } from '../../types/environment-version.types';
import { releaseVersionIdentity } from '../../utils/release-version-display.model';

export function CandidateVersionStatus(props: { active: boolean; blocked: boolean }) {
  const t = useTranslations('projects');
  if (props.active) {
    return (
      <StatusTag
        status="success"
        label={t('environmentVersionDeployedBadge')}
      />
    );
  }
  if (props.blocked) {
    return (
      // 说明该徽章等的是「生产发布运行(ReleaseRun)」的审批，而不是审批中心里
      // 任意待办；需先在发布单详情申请生产发布审批并执行，避免“批完所有审批
      // 仍显示待生产审批”的误读。
      <span title={t('environmentVersionApprovalPendingHint')}>
        <StatusTag
          status="warning"
          label={t('environmentVersionApprovalPendingShort')}
        />
      </span>
    );
  }
  return (
    <StatusTag
      status="default"
      label={t('versionAvailable')}
    />
  );
}

export function CurrentEnvironmentVersion({ current }: { current?: EnvironmentVersionItem }) {
  const t = useTranslations('projects');
  const identity = current
    ? releaseVersionIdentity(current.releaseOrder.releaseVersion, current.releaseOrder.releaseName)
    : null;
  const version = identity
    ? identity.canonical
      ? identity.version
      : t('releaseLegacyVersionValue', { version: identity.version })
    : '—';
  const name = identity
    ? identity.name || (identity.canonical ? identity.version : t('releaseLegacyNameFallback'))
    : '—';
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{t('environmentVersionCurrent')}</h4>
      <div className="grid gap-4 rounded-lg border px-5 py-4 md:grid-cols-4">
        <VersionFact
          label={t('releaseVersionLabel')}
          value={version}
          accent
        />
        <VersionFact
          label={t('releaseNameLabel')}
          value={name}
        />
        <VersionFact
          label={t('releaseOrderColumnSource')}
          value={current?.artifactManifest.buildRun.sourceCommitSha.slice(0, 8) ?? '—'}
          mono
        />
        <VersionFact
          label={t('releaseOrderColumnStatus')}
          value={current ? t('environmentVersionDeployedBadge') : '—'}
        />
      </div>
    </div>
  );
}

function VersionFact(props: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p
        className={`${props.mono ? 'font-mono text-xs' : 'font-medium'} ${props.accent ? 'text-xl text-primary' : ''} mt-1`}
      >
        {props.value}
      </p>
    </div>
  );
}
