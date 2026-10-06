'use client';

import { ArrowClockwise } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { Button, ErrorBanner } from '@/components/ui';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { releaseRunStatusLabelKey } from '../../utils/release-copy.model';
import { shortTechnicalId } from '../../utils/release-display.utils';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { formatIso } from '../../utils/release-time.utils';
import { stagingLogDisplay } from '../release-staging-log.model';
import { FlowStatusTag } from './release-flow-status-tag';
import { ReleaseStagingValidationEvidence } from './release-staging-validation-evidence';
import { releaseStagingValidationChecks } from './release-staging-validation.model';

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

export function ReleaseStagingValidationDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const runId = props.run?.id || props.requestedRunId || '—';
  const checks = props.run ? releaseStagingValidationChecks(props.run) : [];
  return (
    <Drawer
      open={Boolean(props.run || props.requestedRunId)}
      onClose={props.onClose}
      title={t('releaseStagingValidationDrawerTitle', { id: shortTechnicalId(runId) })}
      description={t('releaseStagingValidationDrawerDescription')}
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FlowStatusTag
              status={releaseOrderStatusTone(props.run.status)}
              label={t(releaseRunStatusLabelKey(props.run.status))}
            />
            <Button
              variant="outline"
              size="sm"
              loading={props.loading}
              onClick={props.onRetry}
            >
              <ArrowClockwise
                size={14}
                aria-hidden="true"
              />
              {tc('refresh')}
            </Button>
          </div>
          <RunFacts
            run={props.run}
            build={props.build}
          />
          {checks.every((check) => !check.raw) ? (
            <p className="rounded-lg border border-warning/40 p-3 text-sm text-muted-foreground">
              {t('releaseStagingValidationGap')}
            </p>
          ) : null}
          <ReleaseStagingValidationEvidence checks={checks} />
          <section className="rounded-lg border p-3">
            <h4 className="text-sm font-medium">{t('releaseStagingExecutionLogs')}</h4>
            <pre
              className="mt-2 whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-xs"
              role="log"
            >
              {stagingLogDisplay(props.run.logs, t('releaseStagingLogsEmpty'))}
            </pre>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

function RunFacts(props: { run: ReleaseStagingDeploymentItem; build: ReleaseBuildItem | null }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const facts = [
    [t('releaseStagingDeploymentRunId'), props.run.id],
    [t('releaseBuildManifestId'), props.run.artifactManifestId || '—'],
    [t('releaseBuildManifestDigest'), props.build?.manifest?.digest || '—'],
    [t('releaseBuildEnvironment'), props.run.environmentId || '—'],
    [t('releaseBuildStartedAt'), formatIso(props.run.startedAt)],
    [t('releaseBuildFinishedAt'), formatIso(props.run.finishedAt)],
  ];
  return (
    <dl className="grid gap-3 rounded-lg border p-3 text-xs sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div
          key={label}
          className="min-w-0"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-all font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
