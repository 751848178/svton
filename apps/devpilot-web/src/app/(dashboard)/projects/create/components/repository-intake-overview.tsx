import React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';

const OPTIONS = {
  projectType: ['web_application', 'backend_service', 'static_site', 'mixed_application'],
  architecture: ['monorepo', 'single_repository'],
  packageManager: ['npm', 'pnpm', 'yarn', 'bun', 'unknown'],
  deploymentPlan: ['container', 'docker_compose', 'static_site', 'process'],
} as const;

export function RepositoryIntakeOverview({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  const overview = intake.contract?.overview;
  if (!overview) return null;
  const review = intake.reviewItems.find((item) => item.suggestionId === overview.suggestionId);
  const display = { ...overview.value, ...review?.overrides };
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby="intake-overview-title">
      <div className="flex items-center justify-between gap-3">
        <div><h3 id="intake-overview-title" className="font-semibold">{t('intakeOverviewTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('intakeOverviewHint')}</p></div>
        <span className="text-xs text-amber-700 dark:text-amber-300">{t('intakeRequired')}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(OPTIONS) as Array<keyof typeof OPTIONS>).map((field) => (
          <label key={field} className="space-y-1 text-sm font-medium">
            <span>{t(`intakeField${capitalize(field)}`)}</span>
            <Select
              disabled={intake.reviewLocked}
              value={String(display[field])}
              onChange={(event) => intake.updateReviewOverride(overview.suggestionId, field, event.target.value)}
              options={OPTIONS[field].map((value) => ({ label: t(`intakeValue${pascal(value)}`), value }))}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function capitalize(value: string) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function pascal(value: string) { return value.split('_').map(capitalize).join(''); }
