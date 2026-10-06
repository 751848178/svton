'use client';

import React, { type ReactNode } from 'react';
import { ClockCounterClockwise, Hammer, RocketLaunch } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { PROJECT_COMPACT_ACTION_CLASS } from '../project-workbench-surface';

export function ReleaseBuildActionBar(props: {
  basic?: boolean;
  hasBuild: boolean;
  building: boolean;
  frozen: boolean;
  allowed: boolean;
  blockedReason?: string;
  onOpenHistory?: () => void;
  onBuildLatest: () => void;
}) {
  const t = useTranslations('projects');
  const disabled = props.building || props.frozen || !props.allowed;
  const message = props.building
    ? t('releaseBuildActionRunning')
    : props.frozen
      ? t('releaseBuildFrozenReason')
      : !props.allowed
        ? props.blockedReason || t('releaseBuildUnavailable')
        : t(
            props.basic
              ? props.hasBuild
                ? 'releaseBasicBuildActionReady'
                : 'releaseBasicBuildEmpty'
              : props.hasBuild
                ? 'releaseBuildActionReady'
                : 'releaseRoundNoBuild',
          );
  return (
    <LifecycleActionBar
      contextId="lifecycle-build-action-context"
      message={message}
    >
      {props.onOpenHistory ? (
        <ActionButton
          variant="ghost"
          onClick={props.onOpenHistory}
        >
          <ClockCounterClockwise
            size={14}
            aria-hidden="true"
          />
          {t('releaseRoundViewHistory')}
        </ActionButton>
      ) : null}
      <ActionButton
        loading={props.building}
        disabled={disabled}
        aria-describedby={disabled ? 'lifecycle-build-action-context' : undefined}
        onClick={props.onBuildLatest}
      >
        <Hammer
          size={15}
          weight="bold"
          aria-hidden="true"
        />
        {t('buildLatestCode')}
      </ActionButton>
    </LifecycleActionBar>
  );
}

export function ReleasePublishActionBar(props: {
  basic?: boolean;
  deploying: boolean;
  completed?: boolean;
  disabled: boolean;
  disabledReason?: string;
  repairHref?: string;
  onOpenHistory?: () => void;
  onPublish: () => void;
}) {
  const t = useTranslations('projects');
  const disabled = props.disabled || Boolean(props.completed);
  const message = props.deploying
    ? t('releaseStagingDeployActionRunning')
    : props.completed
      ? t('releaseBasicDeployCompleted')
      : disabled
        ? props.disabledReason || t('releaseWorkbenchPublishDisabledNoManifest')
        : t(props.basic ? 'releaseBasicDeployActionReady' : 'releaseStagingDeployActionReady');
  return (
    <LifecycleActionBar
      contextId="lifecycle-publish-action-context"
      message={message}
      repair={
        disabled && props.repairHref ? (
          <a
            className={`${PROJECT_COMPACT_ACTION_CLASS} ml-1 align-middle font-medium text-primary hover:underline`}
            href={props.repairHref}
          >
            {t('releaseWorkbenchOpenTargetSettings')}
          </a>
        ) : null
      }
    >
      {props.onOpenHistory ? (
        <ActionButton
          variant="ghost"
          onClick={props.onOpenHistory}
        >
          <ClockCounterClockwise
            size={14}
            aria-hidden="true"
          />
          {t('releaseRoundViewHistory')}
        </ActionButton>
      ) : null}
      <ActionButton
        loading={props.deploying}
        disabled={disabled}
        aria-describedby={disabled ? 'lifecycle-publish-action-context' : undefined}
        onClick={props.onPublish}
      >
        <RocketLaunch
          size={15}
          weight="bold"
          aria-hidden="true"
        />
        {t(
          props.basic && props.completed
            ? 'releaseBasicDeployedAction'
            : props.basic && props.deploying
              ? 'releaseBasicDeployingAction'
              : props.basic
                ? 'releaseBasicDeployAction'
                : 'releaseWorkbenchPublishAction',
        )}
      </ActionButton>
    </LifecycleActionBar>
  );
}

function LifecycleActionBar(props: {
  contextId: string;
  message: string;
  repair?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="release-lifecycle-action-bar"
      className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <p
        id={props.contextId}
        data-testid="release-lifecycle-action-context"
        className="min-w-0 text-left text-xs leading-5 text-muted-foreground"
      >
        {props.message}
        {props.repair}
      </p>
      <div
        data-testid="release-lifecycle-action-buttons"
        className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end"
      >
        {props.children}
      </div>
    </div>
  );
}

function ActionButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      size="sm"
      className={`${PROJECT_COMPACT_ACTION_CLASS} flex-1 gap-1.5 sm:flex-none ${props.className ?? ''}`}
    />
  );
}
