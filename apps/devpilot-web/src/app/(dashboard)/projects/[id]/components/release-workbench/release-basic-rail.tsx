'use client';

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { BasicReleaseStage, BasicReleaseStageView } from './release-basic-flow.model';
import styles from './release-lifecycle-rail.module.css';

export function BasicReleaseRail(props: {
  stages: BasicReleaseStageView[];
  selected: BasicReleaseStage;
  onSelect: (stage: BasicReleaseStage) => void;
}) {
  const t = useTranslations('projects');
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = keyboardTarget(event.key, index, props.stages);
    if (!next) return;
    event.preventDefault();
    props.onSelect(next.stage.key);
    refs.current[next.index]?.focus();
  };

  return (
    <nav
      className={styles.rail}
      style={{ '--release-stage-count': props.stages.length } as CSSProperties}
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
            id={`basic-release-stage-tab-${stage.key}`}
            aria-controls={`basic-release-stage-panel-${stage.key}`}
            aria-selected={selected}
            aria-disabled={disabled}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            className={clsx(styles.stage, selected ? styles.selected : styles[stage.state])}
            data-stage={stage.key}
            data-state={stage.state}
            onClick={() => props.onSelect(stage.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className={styles.label}>{t(stage.labelKey)}</span>
            <span className={styles.description}>{t(stage.descriptionKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function keyboardTarget(key: string, index: number, stages: BasicReleaseStageView[]) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return null;
  const enabled = stages
    .map((stage, itemIndex) => ({ stage, index: itemIndex }))
    .filter(({ stage }) => stage.state !== 'disabled');
  const current = Math.max(
    0,
    enabled.findIndex((item) => item.index === index),
  );
  if (key === 'Home') return enabled[0] ?? null;
  if (key === 'End') return enabled.at(-1) ?? null;
  const delta = key === 'ArrowRight' ? 1 : -1;
  return enabled[(current + delta + enabled.length) % enabled.length] ?? null;
}
