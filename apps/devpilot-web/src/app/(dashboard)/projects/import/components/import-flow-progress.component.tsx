'use client';

import { useTranslations } from 'next-intl';

const STEP_KEYS = [
  'importStepScope',
  'importStepSource',
  'importStepDeploy',
  'importStepEnvironment',
  'importStepReview',
] as const;

export const IMPORT_STEP_COUNT = STEP_KEYS.length;

export function ImportFlowProgress({ step }: { step: number }) {
  const t = useTranslations('projects');
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STEP_KEYS.map((key, index) => {
        const complete = index < step;
        const active = index === step;
        return (
          <li
            key={key}
            className={`rounded-md border px-3 py-2 text-sm ${
              active
                ? 'border-primary bg-primary/5 font-medium text-primary'
                : complete
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'text-muted-foreground'
            }`}
          >
            <span className="mr-1.5">{index + 1}.</span>
            {t(key)}
          </li>
        );
      })}
    </ol>
  );
}
