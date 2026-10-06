'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { readSettingsSection } from '../utils/project-route.utils';
import { RepositorySettingsPanel } from './repository-settings-panel';
import { EnvironmentSettingsArea } from './settings/environment-settings-area';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectSettingsContent(props: {
  detail: DetailHook;
  analysis: RepositoryAnalysisHook;
  onRepositoryRunCreated: (runId: string) => void;
}) {
  const searchParams = useSearchParams();
  const detail = props.detail;
  const project = detail.project;
  if (!project) return null;
  if (readSettingsSection(searchParams) === 'repository') {
    return (
      <RepositorySettingsPanel
        analysis={props.analysis}
        onRunCreated={props.onRepositoryRunCreated}
      />
    );
  }
  return <EnvironmentSettingsArea detail={detail} />;
}
