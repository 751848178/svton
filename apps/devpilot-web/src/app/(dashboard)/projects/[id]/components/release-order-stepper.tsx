'use client';

import { Fragment, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import {
  CaretRight,
  CheckCircle,
  Circle,
  CircleNotch,
  WarningOctagon,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { ReleaseOrderStep } from '../types/release-order.types';
import type { ReleaseOrderStepState, ReleaseOrderStepView } from './release-order-stepper.model';

interface Props {
  steps: ReleaseOrderStepView[];
  selectedStep: ReleaseOrderStep;
  onSelect: (step: ReleaseOrderStep) => void;
  children: ReactNode;
}

export function ReleaseOrderStepper({ steps, selectedStep, onSelect, children }: Props) {
  const t = useTranslations('projects');
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const executionStep = steps.find((step) => step.isCurrent) ?? steps[0];
  const viewingStep = steps.find((step) => step.key === selectedStep) ?? steps[0];

  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = keyboardTarget(event.key, index, steps.length);
    if (nextIndex === null) return;
    event.preventDefault();
    const next = steps[nextIndex];
    if (!next) return;
    onSelect(next.key);
    refs.current[nextIndex]?.focus();
  };

  return (
    <section className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t('releaseWorkbenchExecutionContext', {
            step: executionStep ? t(executionStep.labelKey) : '—',
          })}
        </span>
        {executionStep?.key !== viewingStep?.key && viewingStep ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{t('releaseWorkbenchViewingContext', { step: t(viewingStep.labelKey) })}</span>
          </>
        ) : null}
      </div>
      <nav
        className="flex items-center border-y border-border py-2 max-[820px]:flex-col max-[820px]:items-stretch"
        role="tablist"
        aria-label={t('releaseOrderExecutionSteps')}
      >
        {steps.map((step, index) => {
          const selected = step.key === selectedStep;
          const tabId = `${baseId}-${step.key}-tab`;
          return (
            <Fragment key={step.key}>
              <button
                ref={(node) => {
                  refs.current[index] = node;
                }}
                id={tabId}
                type="button"
                role="tab"
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-current={step.isCurrent ? 'step' : undefined}
                aria-controls={panelId}
                data-step={step.key}
                data-state={step.state}
                className={clsx(
                  'flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-muted-foreground transition-colors',
                  'hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                  'max-[820px]:w-full',
                  selected ? 'bg-muted ring-1 ring-inset ring-border' : 'bg-transparent',
                )}
                onClick={() => onSelect(step.key)}
                onKeyDown={(event) => selectFromKeyboard(event, index)}
              >
                <StepIcon state={step.state} />
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
                    {t('releaseStepNumber', { number: String(step.number).padStart(2, '0') })}
                  </span>
                  <strong
                    className={clsx(
                      'mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground',
                      step.isCurrent && step.state !== 'blocked' && 'text-primary',
                      step.state === 'blocked' && 'text-destructive',
                    )}
                  >
                    {t(step.labelKey)}
                  </strong>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {t(step.stateLabelKey)}
                  </span>
                </span>
              </button>
              {index < steps.length - 1 ? (
                <CaretRight
                  aria-hidden="true"
                  data-connector="true"
                  className="shrink-0 text-border max-[820px]:self-center max-[820px]:rotate-90"
                  size={15}
                  weight="regular"
                />
              ) : null}
            </Fragment>
          );
        })}
      </nav>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-${selectedStep}-tab`}
        className="pt-4"
      >
        {children}
      </div>
    </section>
  );
}

function StepIcon({ state }: { state: ReleaseOrderStepState }) {
  const className = clsx(
    'shrink-0',
    state === 'completed' && 'text-emerald-600',
    state === 'current' && 'text-primary',
    state === 'blocked' && 'text-destructive',
    state === 'waiting' && 'text-muted-foreground',
  );
  if (state === 'completed')
    return (
      <CheckCircle
        aria-hidden="true"
        className={className}
        size={20}
      />
    );
  if (state === 'waiting')
    return (
      <Circle
        aria-hidden="true"
        className={className}
        size={20}
      />
    );
  if (state === 'blocked')
    return (
      <WarningOctagon
        aria-hidden="true"
        className={className}
        size={20}
        weight="fill"
      />
    );
  return (
    <CircleNotch
      aria-hidden="true"
      className={className}
      size={20}
    />
  );
}

function keyboardTarget(key: string, index: number, length: number) {
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + length) % length;
  return null;
}
