'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import type { EnvironmentVersionCandidate } from '../../types/environment-version.types';
import { approvedEnvironmentVersionRun } from '../environment-version-card';
import { releaseVersionIdentity } from '../../utils/release-version-display.model';

export function EnvironmentVersionDetail(props: {
  candidate?: EnvironmentVersionCandidate;
  active: boolean;
  production: boolean;
}) {
  const t = useTranslations('projects');
  const item = props.candidate;
  if (!item) {
    return (
      <aside className="border-l pl-6 text-sm text-muted-foreground">
        {t('environmentVersionNoCandidates')}
      </aside>
    );
  }
  const approved = Boolean(approvedEnvironmentVersionRun(item));
  const identity = releaseVersionIdentity(
    item.releaseOrder.releaseVersion,
    item.releaseOrder.releaseName,
  );
  return (
    <aside className="space-y-5 border-l pl-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold">
            {identity.name ||
              (identity.canonical ? identity.version : t('releaseLegacyNameFallback'))}
          </h4>
          <StatusTag
            status={props.active || approved ? 'success' : props.production ? 'warning' : 'default'}
            label={
              props.active
                ? t('environmentVersionDeployedBadge')
                : approved
                  ? t('environmentVersionApproved')
                  : props.production
                    ? t('environmentVersionApprovalPendingShort')
                    : t('versionAvailable')
            }
          />
        </div>
        <p className="mt-2 text-xl font-semibold">
          {identity.canonical
            ? identity.version
            : t('releaseLegacyVersionValue', { version: identity.version })}
        </p>
      </div>
      <Divider />
      <div className="space-y-3">
        <h5 className="text-sm font-semibold">{t('environmentVersionReleaseEvidence')}</h5>
        <Fact
          label={t('environmentVersionBuildRevision')}
          value={`R${item.buildRun.revision}`}
        />
        <Fact
          label={t('environmentVersionStagingEvidence')}
          value={t('environmentVersionEvidenceCount', { count: item.deploymentRuns.length })}
        />
      </div>
      <Divider />
      <Fact
        label={t('releaseOrderColumnSource')}
        value={`${item.buildRun.sourceBranch} @ ${item.buildRun.sourceCommitSha.slice(0, 8)}`}
        mono
      />
      <Divider />
      <Fact
        label={t('environmentVersionCreatedAt')}
        value={formatDateTime(item.createdAt)}
      />
    </aside>
  );
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className={`${props.mono ? 'font-mono text-xs' : 'text-sm'} mt-1 font-medium`}>
        {props.value}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="border-t" />;
}
