'use client';

import {
  CaretDown,
  CheckSquareOffset,
  CloudArrowUp,
  Hammer,
  RocketLaunch,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import {
  releaseApprovalStatusLabelKey,
  releaseExecutionStatusLabelKey,
} from '../../utils/release-copy.model';
import {
  buildReleaseWorkbenchActivityGroups,
  type ReleaseWorkbenchActivity,
  type ReleaseWorkbenchActivityGroup,
  type ReleaseWorkbenchActivityGroupKind,
} from './release-workbench-activity.model';

export function ReleaseWorkbenchActivityPanel(props: {
  activities: ReleaseWorkbenchActivity[];
  loading: boolean;
  error: string;
  onOpen: (activity: ReleaseWorkbenchActivity) => void;
}) {
  const t = useTranslations('projects');
  const groups = buildReleaseWorkbenchActivityGroups(props.activities);
  return (
    <div
      id="release-workbench-activity"
      role="tabpanel"
      aria-labelledby="release-workbench-activity-tab"
      className="max-h-[680px] overflow-y-auto"
    >
      {props.loading ? (
        <p className="px-4 py-5 text-sm text-muted-foreground" role="status">
          {t('releaseWorkbenchActivityLoading')}
        </p>
      ) : null}
      {props.error ? (
        <p className="px-4 py-5 text-sm text-destructive" role="alert">
          {t('releaseWorkbenchEvidenceUnavailable')}
        </p>
      ) : null}
      {!props.loading && groups.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">
          {t('releaseWorkbenchActivityEmpty')}
        </p>
      ) : null}
      {groups.length > 0 ? (
        <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
          {t('releaseWorkbenchRecentActivityHint')}
        </p>
      ) : null}
      {groups.map((group) => (
        <ActivityGroup
          key={group.kind}
          group={group}
          onOpen={props.onOpen}
        />
      ))}
    </div>
  );
}

function ActivityGroup(props: {
  group: ReleaseWorkbenchActivityGroup;
  onOpen: (activity: ReleaseWorkbenchActivity) => void;
}) {
  const t = useTranslations('projects');
  const { group } = props;
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="flex min-h-11 w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
        onClick={() => props.onOpen(group.latest)}
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <GroupIcon kind={group.kind} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm font-medium">
              {t(`releaseWorkbenchActivityGroup.${group.kind}`)}
            </strong>
            <ActivityStatus activity={group.latest} />
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {group.latest.actor ? `${group.latest.actor} · ` : ''}
            {formatDateTimeMinute(group.latest.at)}
            {' · '}
            {t('releaseWorkbenchActivityRecordCount', { count: group.count })}
          </span>
        </span>
      </button>
      {group.history.length > 0 ? (
        <details className="group/history px-4 pb-3 pl-[60px]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            {t('releaseWorkbenchPreviousActivity', { count: group.history.length })}
            <CaretDown
              size={13}
              className="transition-transform group-open/history:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="divide-y divide-border border-l border-border pl-3">
            {group.history.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-xs hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => props.onOpen(activity)}
              >
                <span className="min-w-0 truncate">
                  {t(`releaseWorkbenchActivity.${activity.kind}`)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatDateTimeMinute(activity.at)}
                </span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function ActivityStatus({ activity }: { activity: ReleaseWorkbenchActivity }) {
  const t = useTranslations('projects');
  const approval = activity.kind === 'approval';
  return (
    <StatusTag
      status={activity.status}
      label={t(
        approval
          ? releaseApprovalStatusLabelKey(activity.status)
          : releaseExecutionStatusLabelKey(activity.status),
      )}
    />
  );
}

function GroupIcon({ kind }: { kind: ReleaseWorkbenchActivityGroupKind }) {
  const icons = {
    order: CheckSquareOffset,
    build: Hammer,
    staging: CloudArrowUp,
    production: RocketLaunch,
  };
  const Icon = icons[kind];
  return <Icon size={17} aria-hidden="true" />;
}
