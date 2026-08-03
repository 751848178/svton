import { useTranslations } from 'next-intl';

const STEPS = ['intakeStepConnect', 'intakeStepReview', 'intakeStepBaseline'] as const;

export function ProjectIntakeStepper({ step }: { step: number }) {
  const t = useTranslations('projects');
  return (
    <nav
      className="grid gap-3 sm:grid-cols-3"
      aria-label={t('intakeSteps')}
    >
      {STEPS.map((label, index) => {
        const number = index + 1;
        const current = number === step;
        const completed = number < step;
        return (
          <div
            key={label}
            aria-current={current ? 'step' : undefined}
            className={`rounded-lg border p-4 ${
              current ? 'border-primary bg-primary/5' : completed ? 'bg-muted/40' : ''
            }`}
          >
            <p className="text-xs text-muted-foreground">
              {completed ? t('intakeStepCompleted') : t('intakeStepNumber', { number })}
            </p>
            <p className="mt-1 font-medium">{t(label)}</p>
          </div>
        );
      })}
    </nav>
  );
}
