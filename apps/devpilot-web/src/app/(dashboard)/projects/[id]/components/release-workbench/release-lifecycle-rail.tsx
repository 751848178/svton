'use client';

import { useRef, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { ReleaseLifecycleStage, ReleaseLifecycleStageView } from './release-lifecycle.model';
import {
  releaseLifecycleStagePanelId,
  releaseLifecycleStageTabId,
} from './release-lifecycle-dom.model';
import styles from './release-lifecycle-rail.module.css';

interface Props {
  stages: ReleaseLifecycleStageView[];
  selected: ReleaseLifecycleStage;
  onSelect: (stage: ReleaseLifecycleStage) => void;
}

export function ReleaseLifecycleRail(props: Props) {
  const t = useTranslations('projects');
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = keyboardTarget(event.key, index, props.stages);
    if (next === null) return;
    event.preventDefault();
    const stage = props.stages[next];
    if (!stage) return;
    props.onSelect(stage.key);
    refs.current[next]?.focus();
  };

  return (
    <nav
      className={styles.rail}
      role="tablist"
      aria-label={t('releaseLifecycleNavigation')}
    >
      {props.stages.map((stage, index) => {
        const selected = stage.key === props.selected;
        const disabled = stage.state === 'disabled';
        return (
          <button
            key={stage.key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={releaseLifecycleStageTabId(stage.key)}
            aria-controls={releaseLifecycleStagePanelId(stage.key)}
            aria-selected={selected}
            aria-disabled={disabled}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            className={clsx(styles.stage, selected ? styles.selected : styles[stage.state])}
            data-stage={stage.key}
            data-state={stage.state}
            onClick={() => props.onSelect(stage.key)}
            onKeyDown={(event) => selectFromKeyboard(event, index)}
          >
            <span className={styles.label}>{t(stage.labelKey)}</span>
            <span className={styles.description}>{t(stage.descriptionKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function keyboardTarget(key: string, current: number, stages: ReleaseLifecycleStageView[]) {
  const enabled = stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.state !== 'disabled')
    .map(({ index }) => index);
  if (key === 'Home') return enabled[0] ?? null;
  if (key === 'End') return enabled.at(-1) ?? null;
  if (!['ArrowLeft', 'ArrowRight'].includes(key)) return null;
  const position = Math.max(0, enabled.indexOf(current));
  const delta = key === 'ArrowRight' ? 1 : -1;
  return enabled[(position + delta + enabled.length) % enabled.length] ?? null;
}
