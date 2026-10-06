'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Check, Circle, Warning } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { ReleaseLifecycleStep, ReleaseLifecycleStepView } from './release-lifecycle.model';
import {
  releaseLifecycleStepPanelId,
  releaseLifecycleStepTabId,
} from './release-lifecycle-dom.model';
import styles from './release-lifecycle-substeps.module.css';

interface Props {
  steps: ReleaseLifecycleStepView[];
  selected: ReleaseLifecycleStep;
  onSelect: (step: ReleaseLifecycleStep) => void;
}

export function ReleaseLifecycleSubsteps(props: Props) {
  const t = useTranslations('projects');
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = keyboardTarget(event.key, index, props.steps);
    if (next === null) return;
    event.preventDefault();
    const step = props.steps[next];
    if (!step) return;
    props.onSelect(step.key);
    refs.current[next]?.focus();
  };
  return (
    <nav
      className={styles.substeps}
      style={{ '--step-count': props.steps.length } as React.CSSProperties}
      role="tablist"
      aria-label={t('releaseLifecycleSubsteps')}
    >
      {props.steps.map((step, index) => {
        const selected = step.key === props.selected;
        const disabled = step.state === 'disabled';
        return (
          <button
            key={step.key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={releaseLifecycleStepTabId(step.key)}
            aria-controls={releaseLifecycleStepPanelId(step.key)}
            aria-selected={selected}
            aria-disabled={disabled}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            className={clsx(
              styles.substep,
              selected && styles.substepSelected,
              step.state === 'current' && styles.substepCurrent,
              step.state === 'done' && styles.substepDone,
              disabled && styles.substepDisabled,
            )}
            onClick={() => props.onSelect(step.key)}
            onKeyDown={(event) => selectFromKeyboard(event, index)}
          >
            <span className={styles.substepIcon}>
              <StepIcon state={step.state} />
            </span>
            <span className={styles.substepText}>{t(step.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function keyboardTarget(key: string, current: number, steps: ReleaseLifecycleStepView[]) {
  const enabled = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.state !== 'disabled')
    .map(({ index }) => index);
  if (key === 'Home') return enabled[0] ?? null;
  if (key === 'End') return enabled.at(-1) ?? null;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return null;
  const position = Math.max(0, enabled.indexOf(current));
  const forwards = key === 'ArrowRight' || key === 'ArrowDown';
  const delta = forwards ? 1 : -1;
  return enabled[(position + delta + enabled.length) % enabled.length] ?? null;
}

function StepIcon({ state }: { state: ReleaseLifecycleStepView['state'] }) {
  if (state === 'done')
    return (
      <Check
        size={13}
        weight="bold"
        aria-hidden="true"
      />
    );
  if (state === 'blocked')
    return (
      <Warning
        size={12}
        weight="fill"
        aria-hidden="true"
      />
    );
  return (
    <Circle
      size={9}
      weight="fill"
      aria-hidden="true"
    />
  );
}
