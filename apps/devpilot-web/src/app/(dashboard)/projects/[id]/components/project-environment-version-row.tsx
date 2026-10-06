'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
  EnvironmentVersionItem,
} from '../types/environment-version.types';
import { releaseExecutionStatusLabelKey } from '../utils/release-copy.model';
import { releaseVersionIdentity } from '../utils/release-version-display.model';
import { settingsEnvironmentTabHref } from '../utils/settings-environment-route';
import { PROJECT_COMPACT_ACTION_CLASS } from './project-workbench-surface';

export interface EnvironmentVersionSelection {
  environment: EnvironmentVersionEnvironment;
  candidateId: string;
}

export function ProjectEnvironmentVersionRow(props: {
  projectId: string;
  environment: EnvironmentVersionEnvironment;
  candidates: EnvironmentVersionCandidate[];
  onSwitch: (selection: EnvironmentVersionSelection) => void;
}) {
  const t = useTranslations('projects');
  const current = currentVersion(props.environment);
  const source = props.candidates.find((item) => item.id === current?.artifactManifestId);
  const available = props.candidates.find((item) => item.id !== current?.artifactManifestId);
  return (
    <tr>
      <td className="font-semibold">{props.environment.name}</td>
      <td>{current ? environmentVersionName(current) : '—'}</td>
      <td className="font-mono text-xs">{source ? environmentVersionSource(source) : '—'}</td>
      <td>{current ? formatDateTimeMinute(current.effectiveAt) : '—'}</td>
      <td>{current ? t(releaseExecutionStatusLabelKey(current.deploymentRun.status)) : '—'}</td>
      <td className="text-right">
        <span className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            disabled={!available}
            className={`${PROJECT_COMPACT_ACTION_CLASS} font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline`}
            onClick={() =>
              available &&
              props.onSwitch({ environment: props.environment, candidateId: available.id })
            }
          >
            {t('switchToVersion')}
          </button>
          <Link
            href={settingsEnvironmentTabHref(props.projectId, props.environment.key, 'versions')}
            className={`${PROJECT_COMPACT_ACTION_CLASS} font-medium text-primary hover:underline`}
          >
            {t('environmentVersionConfigLink')}
          </Link>
        </span>
      </td>
    </tr>
  );
}

export function environmentVersionLabel(item: EnvironmentVersionCandidate) {
  const identity = releaseVersionIdentity(
    item.releaseOrder.releaseVersion,
    item.releaseOrder.releaseName,
  );
  return identity.name ? `${identity.name} ${identity.version}` : identity.version;
}

function currentVersion(environment: EnvironmentVersionEnvironment) {
  return environment.environmentVersions.find(
    (item) => item.id === environment.currentEnvironmentVersionId,
  );
}

function environmentVersionName(item: EnvironmentVersionItem) {
  const identity = releaseVersionIdentity(
    item.releaseOrder.releaseVersion,
    item.releaseOrder.releaseName,
  );
  return identity.name ? `${identity.name} ${identity.version}` : identity.version;
}

function environmentVersionSource(item: EnvironmentVersionCandidate) {
  return `${item.buildRun.sourceBranch} @ ${item.buildRun.sourceCommitSha.slice(0, 8)}`;
}
