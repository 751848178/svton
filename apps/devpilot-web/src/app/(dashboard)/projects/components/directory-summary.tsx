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
          className="rounded-xl border bg-card px-5 py-4"
        >
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </article>
      ))}
    </section>
  );
}
