import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Select } from '@/components/ui';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';

export function RepositoryIntakeDependencies({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const blocked = intake.reviewBlockers.length > 0;
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby="intake-dependencies-title">
      <div><h3 id="intake-dependencies-title" className="font-semibold">{t('intakeDependenciesTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('intakeDependenciesHint')}</p></div>
      {intake.contract?.dependencies.map((dependency) => {
        const review = intake.reviewItems.find((item) => item.suggestionId === dependency.suggestionId);
        return (
          <div key={dependency.suggestionId} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/30 p-3">
            <div><p className="text-sm font-medium">{t(dependency.kind === 'environment'
              ? 'intakeEnvironmentDependency' : 'intakeResourceRequirement')}</p>
              <p className="text-xs text-muted-foreground">{t('intakeRequiredByCount', { count: dependency.requiredBy.length })}</p></div>
            <Select disabled={intake.reviewLocked} className="w-36" value={review?.decision ?? dependency.decision ?? 'accept'}
              onChange={(event) => intake.updateReviewDecision(dependency.suggestionId, event.target.value as 'accept' | 'reject')}
              options={['accept', 'reject'].map((value) => ({ label: t(`intakeDecision${capitalize(value)}`), value }))} />
          </div>
        );
      })}
      {blocked && !intake.reviewLocked ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="alert">
          <p className="font-medium">{t('intakeDependencyBlocked')}</p>
          <p className="mt-1 text-muted-foreground">{t('intakeDependencyRecovery')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => acceptEnvironment(intake)}>{t('intakeAcceptDependency')}</Button>
            <Button type="button" variant="outline" onClick={() => rejectComponents(intake)}>{t('intakeRejectDependents')}</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function acceptEnvironment(intake: ProjectIntakeHook) {
  intake.contract?.dependencies.filter((item) => item.kind === 'environment')
    .forEach((item) => intake.updateReviewDecision(item.suggestionId, 'accept'));
}
function rejectComponents(intake: ProjectIntakeHook) {
  intake.contract?.components.forEach((item) => intake.updateReviewDecision(item.suggestionId, 'reject'));
}
function capitalize(value: string) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
