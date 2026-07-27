'use client';

import { useTranslations } from 'next-intl';
import type { EnvironmentResourceBulkBindResult } from '../../types/environment-copy';

export function ResourceBindResult({ result }: { result: EnvironmentResourceBulkBindResult }) {
  const t = useTranslations('projects');
  return (
    <details
      className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3"
      open
    >
      <summary className="cursor-pointer text-sm font-medium">
        {t('bindResultSummary', {
          applied: result.appliedCount,
          skipped: result.skippedCount,
          environment: result.environment.name,
        })}
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">{t('bindResultReadback')}</p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
        {result.steps.map((step) => (
          <li
            key={`${step.type}:${step.resourceId}`}
            className="rounded bg-background px-2 py-1.5"
          >
            <span className="font-medium">{step.title}</span>
            <span className="ml-2 text-muted-foreground">
              {step.status} · {step.description}
            </span>
          </li>
        ))}
      </ul>
      {result.warnings.length > 0 ? (
        <p className="mt-2 text-xs text-amber-700">{result.warnings.join('；')}</p>
      ) : null}
    </details>
  );
}
