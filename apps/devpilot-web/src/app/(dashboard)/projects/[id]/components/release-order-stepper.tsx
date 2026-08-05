'use client';

import { Fragment, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CaretRight, CheckCircle, Circle, CircleNotch } from '@phosphor-icons/react';
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
    <section className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <nav
        className="flex items-center border-b border-slate-200 bg-slate-50 px-4 py-[17px] max-[820px]:flex-col max-[820px]:items-stretch"
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
                  'flex min-w-0 flex-1 items-center gap-[9px] rounded-lg border px-[10px] py-[9px] text-left text-slate-500 transition-colors',
                  'hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(79,70,229,0.42)] focus-visible:ring-offset-2',
                  'max-[820px]:w-full',
                  selected
                    ? 'border-indigo-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
                    : 'border-transparent bg-transparent',
                )}
                onClick={() => onSelect(step.key)}
                onKeyDown={(event) => selectFromKeyboard(event, index)}
              >
                <StepIcon state={step.state} />
                <span className="min-w-0">
                  <span className="block text-[9px] font-bold tracking-[0.035em] text-slate-500">
                    {t('releaseStepNumber', { number: String(step.number).padStart(2, '0') })}
                  </span>
                  <strong
                    className={clsx(
                      'mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-700',
                      (selected || step.state === 'current' || step.state === 'blocked') &&
                        'text-indigo-900',
                    )}
                  >
                    {t(step.labelKey)}
                  </strong>
                  <span className="mt-0.5 block text-[9px] text-slate-400">
                    {t(step.stateLabelKey)} <span aria-hidden="true">·</span>{' '}
                    {step.summary.values
                      ? t(step.summary.key, step.summary.values)
                      : t(step.summary.key)}
                  </span>
                </span>
              </button>
              {index < steps.length - 1 ? (
                <CaretRight
                  aria-hidden="true"
                  data-connector="true"
                  className="shrink-0 text-slate-300 max-[820px]:self-center max-[820px]:rotate-90"
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
        className="p-4"
      >
        {children}
      </div>
    </section>
  );
}

function StepIcon({ state }: { state: ReleaseOrderStepState }) {
  const className = clsx(
    'shrink-0',
    state === 'completed' && 'text-green-600',
    (state === 'current' || state === 'blocked') && 'text-indigo-600',
    state === 'waiting' && 'text-slate-400',
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
