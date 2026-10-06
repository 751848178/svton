'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { shortTechnicalId } from '../utils/release-display.utils';
import { ReleaseStagingLogTabs } from './release-workbench/release-staging-log-tabs';

interface Props {
  projectId: string;
  run: ReleaseStagingDeploymentItem | null;
  build: ReleaseBuildItem | null;
  requestedRunId?: string;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
}

export function ReleaseStagingLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const runId = props.run?.id || props.requestedRunId || '—';
  return (
    <Drawer
      open={Boolean(props.run || props.requestedRunId)}
      onClose={props.onClose}
      title={t('releaseStagingLogTitle', { id: shortTechnicalId(runId) })}
      description={t('releaseStagingLogDescription')}
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      {props.loading ? <LoadingState text={t('releaseStagingDetailLoading')} /> : null}
      {props.error ? (
        <ErrorBanner
          message={props.error}
          onRetry={props.onRetry}
        />
      ) : null}
      {props.run ? (
        <ReleaseStagingLogTabs
          projectId={props.projectId}
          run={props.run}
          build={props.build}
        />
      ) : null}
    </Drawer>
  );
}
