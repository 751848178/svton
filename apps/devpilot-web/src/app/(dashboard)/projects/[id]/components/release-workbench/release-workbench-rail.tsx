'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import type { ReleaseOrderEvidenceHook } from '../../hooks/use-release-order-evidence';
import type { ReleaseGateCatalog } from '../../types/release-gate.types';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../../types/release-order.types';
import {
  buildReleaseWorkbenchActivities,
  type ReleaseWorkbenchActivity,
} from './release-workbench-activity.model';
import { ReleaseWorkbenchActivityPanel } from './release-workbench-activity';
import { ReleaseWorkbenchEvidence } from './release-workbench-evidence';

interface Props {
  detail: ReleaseOrderDetail;
  evidence: ReleaseOrderEvidenceHook;
  catalog: ReleaseGateCatalog | null;
  onOpenActivity: (activity: ReleaseWorkbenchActivity) => void;
  onSelectStep: (step: ReleaseOrderStep) => void;
}

export function ReleaseWorkbenchRail(props: Props) {
  const t = useTranslations('projects');
  const [tab, setTab] = useState<'activity' | 'evidence'>('activity');
  const tabRefs = useRef<Record<'activity' | 'evidence', HTMLButtonElement | null>>({
    activity: null,
    evidence: null,
  });
  const activities = buildReleaseWorkbenchActivities(props.detail, props.evidence.evidence);
  const selectFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    current: 'activity' | 'evidence',
  ) => {
    const next = railKeyboardTarget(event.key, current);
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="min-w-0 overflow-hidden border-t border-border xl:border-l xl:border-t-0">
      <div className="border-b border-border px-4 pt-4 xl:pl-5 xl:pr-0 xl:pt-0">
        <h3
          id="release-workbench-rail-title"
          className="text-base font-semibold"
        >
          {t('releaseWorkbenchRailTitle')}
        </h3>
        <div
          className="mt-3 flex gap-5"
          role="tablist"
          aria-label={t('releaseWorkbenchRailTitle')}
        >
          {(['activity', 'evidence'] as const).map((key) => (
            <button
              ref={(node) => {
                tabRefs.current[key] = node;
              }}
              key={key}
              id={`release-workbench-${key}-tab`}
              type="button"
              role="tab"
              tabIndex={tab === key ? 0 : -1}
              aria-selected={tab === key}
              aria-controls={`release-workbench-${key}`}
              className={clsx(
                'min-h-11 border-b-2 px-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                tab === key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setTab(key)}
              onKeyDown={(event) => selectFromKeyboard(event, key)}
            >
              {t(`releaseWorkbenchRailTab.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'activity' ? (
        <ReleaseWorkbenchActivityPanel
          activities={activities}
          loading={props.evidence.loading}
          error={props.evidence.error}
          onOpen={props.onOpenActivity}
        />
      ) : (
        <ReleaseWorkbenchEvidence
          evidence={props.evidence}
          catalog={props.catalog}
          activities={activities}
          onOpen={props.onOpenActivity}
          onSelectStep={props.onSelectStep}
        />
      )}
    </section>
  );
}

function railKeyboardTarget(key: string, current: 'activity' | 'evidence') {
  if (key === 'Home') return 'activity';
  if (key === 'End') return 'evidence';
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return current === 'activity' ? 'evidence' : 'activity';
  }
  return null;
}
