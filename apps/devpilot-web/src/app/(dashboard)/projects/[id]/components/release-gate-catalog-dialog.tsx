'use client';

import React from 'react';
import clsx from 'clsx';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type {
  LocalizedGateText,
  ReleaseGateCatalog,
  ReleaseGatePhase,
} from '../types/release-gate.types';
import { ReleaseGatePhaseSection } from './release-gate-phase-section';
import { capabilityDotTone, capabilityNameResolver } from './release-gate-catalog-dialog.model';
import { buildReleaseGateSummary } from './release-gate-summary.model';

const PHASES: ReleaseGatePhase[] = ['commit', 'build', 'deploy', 'promote'];

interface Props {
  catalog: ReleaseGateCatalog;
  dialogId: string;
  open: boolean;
  filterCapabilityIds: readonly string[] | null;
  /** 复核修 3（追加轮）：能力组概览行可点击切换过滤（受控，状态在面板）。 */
  onFilterCapabilityChange: (ids: readonly string[] | null) => void;
  confirmingGateId: string;
  confirmationError: string;
  onConfirmManual: (gateId: string, evaluationId: string, reason: string) => Promise<boolean>;
  onClose: () => void;
}

export function ReleaseGateCatalogDialog(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const locale = useLocale();
  const summary = buildReleaseGateSummary(props.catalog);
  const localize = (text: LocalizedGateText) => (locale.startsWith('zh') ? text.zh : text.en);
  const capabilityName = capabilityNameResolver(props.catalog.capabilities, localize);
  /* 复核修 3（追加轮）：能力组概览可点击切换过滤——受控状态在面板，
      再点当前组清除过滤回到完整目录。 */
  const capabilityFilter = props.filterCapabilityIds;
  const toggleCapabilityFilter = (id: string) => {
    props.onFilterCapabilityChange(
      capabilityFilter?.length === 1 && capabilityFilter[0] === id ? null : [id],
    );
  };
  const activeCapability =
    capabilityFilter && capabilityFilter.length === 1
      ? props.catalog.capabilities.find((candidate) => candidate.id === capabilityFilter[0])
      : undefined;
  /* 组过滤覆盖该能力组全部阶段的检查项——与概览行的 n/m 计数一致
      （此前仅限当前决策阶段，会出现概览 0/1 点进去 0 项的矛盾）。 */
  const filteredChecks = capabilityFilter
    ? props.catalog.checks.filter(
        (check) => check.capabilityId && capabilityFilter.includes(check.capabilityId),
      )
    : props.catalog.checks;
  const visiblePhases = PHASES.filter((phase) =>
    filteredChecks.some((check) => check.phase === phase),
  );
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      /* PX-22：组过滤时标题标注能力组，不再冒称「完整目录」。 */
      title={
        activeCapability
          ? t('releaseGateGroupDialogTitle', {
              groupId: activeCapability.id,
              name: localize(activeCapability.name),
              count: filteredChecks.length,
            })
          : t('releaseGateCatalogDialogTitle', { count: filteredChecks.length })
      }
      ariaCloseLabel={tc('close')}
      ariaDescriptionId={`${props.dialogId}-description`}
      width={960}
      /* 单层滚动：摘要与 chips 固定，检查列表是弹层内唯一滚动层。 */
      bodyClassName="flex flex-col overflow-hidden"
      footer={
        // PX-21：只读弹窗仅保留「关闭」，删除功能重复的「取消」。
        <Button
          className="min-h-11"
          onClick={props.onClose}
        >
          {t('releaseGateClose')}
        </Button>
      }
    >
      <div
        id={props.dialogId}
        className="flex h-full min-h-0 flex-col gap-5"
      >
        <p
          id={`${props.dialogId}-description`}
          className="text-sm text-muted-foreground"
        >
          {activeCapability
            ? t('releaseGateGroupDialogDescription', { name: localize(activeCapability.name) })
            : t('releaseGateCatalogDialogDescription')}
        </p>
        <dl className="grid grid-cols-2 gap-3 min-[821px]:grid-cols-4">
          {PHASES.map((phase) => (
            <div
              key={phase}
              className="rounded-lg border bg-muted/20 px-4 py-3"
            >
              <dt className="text-xs text-muted-foreground">{t(`releaseGatePhase.${phase}`)}</dt>
              <dd className="mt-1 font-semibold">
                {t('releaseGateCheckCount', {
                  count: filteredChecks.filter((check) => check.phase === phase).length,
                })}
              </dd>
            </div>
          ))}
        </dl>
        {/* 复核修 2：能力组概览改紧凑三列清单（色点+名称+通过数），
            不再渲染 15 枚大胶囊；完整状态放 title，M 码不再上屏。
            复核修 3（追加轮）：整行可点击切换该组过滤，再点清除。 */}
        <div
          role="region"
          tabIndex={0}
          aria-label={t('releaseGateCapabilityGroupsLabel')}
          className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          {summary.capabilities.map((group) => {
            const capability = props.catalog.capabilities.find(
              (candidate) => candidate.id === group.id,
            )!;
            const active = !capabilityFilter || capabilityFilter.includes(group.id);
            const selected = capabilityFilter?.length === 1 && capabilityFilter[0] === group.id;
            const name = localize(capability.name);
            const statusLabel = t(`releaseGateStatus.${group.status}`);
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={selected}
                title={`${name}：${statusLabel}，${t('releaseGatePassingCount', {
                  passing: group.passingCount,
                  total: group.checkCount,
                })}${selected ? '。再次点击查看全部能力组' : ''}`}
                onClick={() => toggleCapabilityFilter(group.id)}
                className={clsx(
                  'flex min-w-0 cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs transition-colors',
                  'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  active ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${capabilityDotTone(group.status)} ${
                    selected ? 'ring-2 ring-primary/30' : ''
                  }`}
                />
                <span
                  className={clsx('min-w-0 truncate', selected && 'font-medium text-foreground')}
                >
                  {name}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {group.passingCount}/{group.checkCount}
                </span>
              </button>
            );
          })}
        </div>
        <div
          role="region"
          tabIndex={0}
          aria-label={t('releaseGateCheckListLabel')}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
        >
          {visiblePhases.map((phase) => (
            <ReleaseGatePhaseSection
              key={phase}
              phase={phase}
              checks={filteredChecks.filter((check) => check.phase === phase)}
              localize={localize}
              locale={locale}
              capabilityName={capabilityName}
              confirmingGateId={props.confirmingGateId}
              confirmationError={props.confirmationError}
              onConfirmManual={props.onConfirmManual}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
