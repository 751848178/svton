'use client';

import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
} from '../types/environment-version.types';
import { EnvironmentVersionSummary } from './environment-version-summary';

export function EnvironmentVersionCard(props: {
  environment: EnvironmentVersionEnvironment;
  candidates: EnvironmentVersionCandidate[];
  selectedId: string;
  executing: boolean;
  productionBlocked: boolean;
  onSelect: (id: string) => void;
  onUpgrade: () => unknown;
  onRecovery: (sourceVersionId: string) => unknown;
}) {
  const t = useTranslations('projects');
  const env = props.environment;
  const production = env.baselineRole === 'production';
  const current = env.environmentVersions.find(
    (item) => item.id === env.currentEnvironmentVersionId,
  );
  const previous = current
    ? env.environmentVersions.find((item) => item.id === current.previousVersionId)
    : null;
  const currentManifestSelected = current?.artifactManifestId === props.selectedId;
  return (
    <article className="space-y-4 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{env.name}</h3>
        {current ? (
          <StatusTag
            status="success"
            label={t('environmentVersionDeployedBadge')}
          />
        ) : (
          <StatusTag
            status="default"
            label={t('environmentVersionUnavailable')}
          />
        )}
      </div>
      {current ? (
        <EnvironmentVersionSummary version={current} />
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('environmentVersionUnavailableDescription')}
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-md bg-muted/30 p-3 sm:flex-row sm:items-end">
        <label className="min-w-56 flex-1 text-sm">
          <span className="mb-1 block font-medium">{t('environmentVersionUpgradeTarget')}</span>
          <select
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
            value={props.selectedId}
            onChange={(event) => props.onSelect(event.target.value)}
            disabled={props.candidates.length === 0}
          >
            {props.candidates.length === 0 ? (
              <option value="">{t('environmentVersionNoCandidates')}</option>
            ) : (
              props.candidates.map((candidate) => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                >
                  {t('environmentVersionCandidateOption', {
                    version: candidate.releaseOrder.releaseVersion,
                    revision: candidate.buildRun.revision,
                  })}
                  {production ? t('environmentVersionCandidateProductionSuffix') : ''}
                </option>
              ))
            )}
          </select>
        </label>
        <Button
          className="min-h-11"
          onClick={props.onUpgrade}
          loading={props.executing}
          disabled={
            !props.selectedId ||
            props.executing ||
            currentManifestSelected ||
            props.productionBlocked
          }
        >
          {t('environmentVersionUpgradeShort')}
        </Button>
        <Button
          className="min-h-11"
          variant="outline"
          disabled={props.executing || !previous}
          onClick={() => (previous ? props.onRecovery(previous.id) : undefined)}
        >
          {t('environmentVersionRollback')}
        </Button>
      </div>
      {props.productionBlocked ? (
        <p className="text-xs text-amber-800">
          {t('environmentVersionProductionApprovalRequired')}
        </p>
      ) : null}
    </article>
  );
}

export function approvedEnvironmentVersionRun(candidate?: EnvironmentVersionCandidate) {
  return candidate?.releaseRuns.find(
    (run) => run.operationApproval?.status === 'approved' && !run.operationApproval.consumedAt,
  )?.id;
}
