/**
 * 右侧轮次信息卡 · 构建信息：当前轮次构建快照 + 构建入口 + 历史入口。
 * 构建动作与构建信息同处（动作伴随其成因）。
 *
 * PX-4：查看步骤 02（构建）详情时压缩同名字段（Commit/摘要/时间已由步骤详情承载）。
 * PX-14：字段值统一 13px/500，不再比标签还小。
 * PX-18：构建钮禁用原因常驻可见。
 */
'use client';

import { Hammer, ClockCounterClockwise } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import { shortDigest } from '../../utils/release-display.utils';
import { formatDuration, formatIso } from '../../utils/release-time.utils';
import {
  releaseBuildStatusLabelKey,
  releaseBuildStatusTone,
} from '../release-build-view.model';

interface Props {
  build: ReleaseBuildItem | null;
  building: boolean;
  buildFrozen: boolean;
  buildGate: { allowed: boolean; reason: string };
  compact?: boolean;
  onBuildLatest: () => void;
  onOpenHistory: () => void;
}

export function ReleaseRoundBuildCard(props: Props) {
  const t = useTranslations('projects');
  const build = props.build;
  const buildDisabled =
    props.building || props.buildFrozen || props.buildGate.allowed === false;
  const buildTitle = props.buildFrozen
    ? t('releaseBuildFrozenReason')
    : props.buildGate.allowed === false
      ? props.buildGate.reason
      : undefined;

  return (
    <section
      className="border-b border-border px-4 py-4 xl:pl-5 xl:pr-4"
      aria-labelledby="release-round-build-title"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="release-round-build-title"
          className="text-sm font-semibold"
        >
          {t('releaseRoundBuildTitle')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onOpenHistory}
        >
          <ClockCounterClockwise
            size={14}
            aria-hidden="true"
          />
          {t('releaseRoundViewHistory')}
        </Button>
      </div>
      {build ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <FlowStatusTag
              status={releaseBuildStatusTone(build.status)}
              label={t(releaseBuildStatusLabelKey(build.status))}
            />
            <span className="text-muted-foreground">
              {t('releaseBuildRevision', { revision: build.revision })} ·{' '}
              {formatDuration(build.startedAt, build.finishedAt) || t('releaseWorkbenchValueEmpty')}
            </span>
          </div>
          {props.compact ? null : (
            <>
              <Fact label={t('releaseBuildCommit')} value={commitLabel(build)} mono />
              {build.manifest ? (
                <Fact
                  label={t('releaseWorkbenchDigest')}
                  value={shortDigest(build.manifest.digest)}
                  title={build.manifest.digest}
                  mono
                />
              ) : null}
              <Fact
                label={t('releaseBuildCreatedAt')}
                value={formatIso(build.createdAt)}
              />
            </>
          )}
        </dl>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t('releaseRoundNoBuild')}</p>
      )}
      <div className="mt-3 flex flex-col gap-1">
        <Button
          className="w-full"
          size="sm"
          variant="outline"
          loading={props.building}
          disabled={buildDisabled}
          aria-describedby={buildDisabled && buildTitle ? 'workbench-build-disabled-reason' : undefined}
          data-testid="workbench-build-action"
          onClick={props.onBuildLatest}
        >
          <Hammer
            size={15}
            weight="bold"
            aria-hidden="true"
          />
          {t('buildLatestCode')}
        </Button>
        {buildDisabled && buildTitle ? (
          <p
            id="workbench-build-disabled-reason"
            data-testid="workbench-build-disabled-reason"
            className="text-xs text-muted-foreground"
          >
            {buildTitle}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{props.label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-[13px] font-medium ${
          props.mono ? 'font-mono text-xs' : ''
        }`}
        title={props.title ?? props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}

function commitLabel(build: ReleaseBuildItem) {
  const commit = build.sourceCommitSha ? build.sourceCommitSha.slice(0, 12) : '—';
  return `${build.sourceBranch} @ ${commit}`;
}
