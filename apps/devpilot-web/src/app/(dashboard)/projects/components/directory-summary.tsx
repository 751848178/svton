import { useTranslations } from 'next-intl';
import type { ProjectDirectoryResponse } from '../types';

export function DirectorySummary({ summary }: { summary?: ProjectDirectoryResponse['summary'] }) {
  const t = useTranslations('projects');
  const values = [
    [t('directoryTotal'), summary?.total ?? 0],
    [t('directoryOnline'), summary?.online ?? 0],
    [t('directoryNeedsConfiguration'), summary?.needsConfiguration ?? 0],
  ];
  return (
    <section
      className="grid gap-3 sm:grid-cols-3"
      aria-label={t('directorySummary')}
    >
      {values.map(([label, value]) => (
        <article
          key={String(label)}
          className="rounded-lg border bg-card px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
        </article>
      ))}
    </section>
  );
}
