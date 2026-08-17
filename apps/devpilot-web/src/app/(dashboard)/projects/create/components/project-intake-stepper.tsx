import { CheckCircle, Circle, CircleNotch } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

const STEPS = ['intakeStepConnect', 'intakeStepReview', 'intakeStepBaseline'] as const;

export function ProjectIntakeStepper({ step }: { step: number }) {
  const t = useTranslations('projects');
  return (
    <nav
      className="grid gap-3 sm:grid-cols-3"
      aria-label={t('intakeSteps')}
    >
      <ol className="contents">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const current = number === step;
          const completed = number < step;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={`${current ? 'flex' : 'hidden'} min-h-11 items-center gap-3 rounded-lg border p-3 sm:flex ${
                current ? 'border-primary bg-primary/5' : completed ? 'bg-muted/40' : ''
              }`}
            >
              <span
                className={`shrink-0 ${completed ? 'text-green-600' : current ? 'text-indigo-600' : 'text-slate-400'}`}
              >
                {completed ? (
                  <CheckCircle
                    size={20}
                    weight="fill"
                    aria-hidden="true"
                  />
                ) : current ? (
                  <CircleNotch
                    size={20}
                    weight="bold"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    size={20}
                    aria-hidden="true"
                  />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.035em] text-slate-600">
                  {completed ? t('intakeStepCompleted') : t('intakeStepNumber', { number })}
                </p>
                <p className="truncate text-sm font-medium">{t(label)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
