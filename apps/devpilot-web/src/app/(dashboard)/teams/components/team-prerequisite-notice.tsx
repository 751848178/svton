'use client';

import { WarningCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';

export function TeamPrerequisiteNotice({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations('teams');

  return (
    <section
      role="alert"
      aria-labelledby="team-prerequisite-title"
      className="rounded-md border border-warning/40 bg-warning/10 p-4"
    >
      <div className="flex items-start gap-3">
        <WarningCircle
          size={20}
          weight="fill"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-warning"
        />
        <div className="min-w-0">
          <h2
            id="team-prerequisite-title"
            className="text-sm font-semibold text-foreground"
          >
            {t('teamRequiredTitle')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('teamRequiredDescription')}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            className="mt-3"
          >
            {t('teamRequiredAction')}
          </Button>
        </div>
      </div>
    </section>
  );
}
