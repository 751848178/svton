import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import {
  describeSuggestedValue,
  isRequiredEnvironmentSuggestion,
  readAnalysisSummary,
} from '../project-intake.utils';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';

export function ReviewAnalysisStep({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const run = intake.run;
  if (!run) return null;
  const summary = readAnalysisSummary(run.summary);
  const pending = run.status === 'queued' || run.status === 'running';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t('intakeReviewTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('intakeReviewDescription')}</p>
        </div>
        <StatusTag
          status={run.status}
          label={t(`runStatus${statusLabel(run.status)}`)}
        />
      </div>

      {pending ? (
        <div className="rounded-lg border bg-muted/30 p-5 text-sm">
          <p className="font-medium">{t('intakeAnalysisRunning')}</p>
          <p className="mt-1 text-muted-foreground">
            {run.currentStage ?? t('intakeAnalysisQueued')}
          </p>
        </div>
      ) : null}

      {run.status === 'failed' || run.status === 'cancelled' ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="font-medium text-red-700 dark:text-red-300">
            {run.errorMessage ?? t('intakeAnalysisFailed')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.errorAction ?? t('intakeAnalysisRetryHint')}
          </p>
          <Button
            className="mt-3"
            type="button"
            onClick={() => void intake.retryAnalysis()}
          >
            {t('intakeRetryAnalysis')}
          </Button>
        </div>
      ) : null}

      {run.status === 'succeeded' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric
              label={t('intakeDetectedServices')}
              value={summary.services}
            />
            <Metric
              label={t('intakeDeployableServices')}
              value={summary.deployableServices}
            />
            <Metric
              label={t('intakeSuggestions')}
              value={summary.suggestions}
            />
            <Metric
              label={t('intakeWarnings')}
              value={summary.warnings}
            />
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {run.branch}@{run.commitSha.slice(0, 12)}
            </p>
            <p className="mt-1 text-muted-foreground">{t('intakeCommitPinned')}</p>
          </div>
          <div className="space-y-3">
            {(run.suggestions ?? []).length === 0 ? (
              <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                {t('intakeNoSuggestions')}
              </p>
            ) : (
              (run.suggestions ?? []).map((suggestion) => {
                const required = isRequiredEnvironmentSuggestion(
                  run,
                  intake.selectedSuggestionIds,
                  suggestion.id,
                );
                return (
                  <label
                    key={suggestion.id}
                    className="flex gap-3 rounded-lg border p-4"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={intake.selectedSuggestionIds.has(suggestion.id)}
                      disabled={suggestion.status !== 'pending' || required}
                      onChange={() => intake.toggleSuggestion(suggestion.id)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{suggestion.impact}</span>
                      <span className="mt-1 block break-all text-xs text-muted-foreground">
                        {describeSuggestedValue(suggestion.proposedValue)}
                      </span>
                      {required ? (
                        <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                          {t('intakeSuggestionRequiredByApplication')}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function statusLabel(status: string) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}
