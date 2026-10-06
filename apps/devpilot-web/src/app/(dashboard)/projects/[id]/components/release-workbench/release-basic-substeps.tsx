'use client';

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Check, Circle, Warning } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { BasicReleaseStep, BasicReleaseStepView } from './release-basic-flow.model';
import styles from './release-lifecycle-substeps.module.css';

export function ReleaseBasicSubsteps(props: {
  steps: BasicReleaseStepView[];
  selected: BasicReleaseStep;
  onSelect: (step: BasicReleaseStep) => void;
}) {
  const t = useTranslations('projects');
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = keyboardTarget(event.key, index, props.steps);
    if (!next) return;
    event.preventDefault();
    props.onSelect(next.step.key);
    refs.current[next.index]?.focus();
  };
  return (
    <nav
      className={styles.substeps}
      style={{ '--step-count': props.steps.length } as CSSProperties}
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
            id={`basic-release-step-tab-${step.key}`}
            aria-controls={`basic-release-step-panel-${step.key}`}
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
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className={styles.substepIcon}>{stepIcon(step.state)}</span>
            <span className={styles.substepText}>{t(step.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function keyboardTarget(key: string, index: number, steps: BasicReleaseStepView[]) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key))
    return null;
  const enabled = steps
    .map((step, itemIndex) => ({ step, index: itemIndex }))
    .filter(({ step }) => step.state !== 'disabled');
  const current = Math.max(
    0,
    enabled.findIndex((item) => item.index === index),
  );
  if (key === 'Home') return enabled[0] ?? null;
  if (key === 'End') return enabled.at(-1) ?? null;
  const forwards = key === 'ArrowRight' || key === 'ArrowDown';
  return enabled[(current + (forwards ? 1 : -1) + enabled.length) % enabled.length] ?? null;
}

function stepIcon(state: BasicReleaseStepView['state']) {
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
