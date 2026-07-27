'use client';

import { useTranslations } from 'next-intl';
import type { ImportProjectForm } from '../types';

export function ImportReview({ form }: { form: ImportProjectForm }) {
  const t = useTranslations('projects');
  const rows = [
    [t('importReviewProject'), form.name || '-'],
    [t('importReviewScope'), form.managementScope],
    [t('importReviewRepository'), form.gitRepo || t('notConfigured')],
    [t('importReviewBranch'), form.branch || '-'],
    [
      t('importReviewStack'),
      [form.language, form.framework, form.packageManager].filter(Boolean).join(' · ') ||
        t('notConfigured'),
    ],
    [
      t('importReviewTarget'),
      form.managementScope === 'resources' ? t('notApplicable') : form.deploymentTarget,
    ],
    [
      t('importReviewCommands'),
      [form.buildCommand, form.deployCommand].filter(Boolean).join(' → ') || t('notConfigured'),
    ],
    [t('importReviewEnvironments'), form.environments.join(' / ')],
  ];
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">{t('importReviewTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('importReviewDescription')}</p>
      </div>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-300">
          {t('importManualTruthTitle')}
        </p>
        <p className="mt-1 leading-6 text-muted-foreground">{t('importManualTruthDescription')}</p>
      </div>
      <dl className="divide-y rounded-md border">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[10rem_1fr]"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
