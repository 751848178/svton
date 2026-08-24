'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Modal, StatusTag } from '@/components/ui';
import type {
  LocalizedGateText,
  ReleaseGateCatalog,
  ReleaseGatePhase,
} from '../types/release-gate.types';
import { ReleaseGatePhaseSection } from './release-gate-phase-section';
import { buildReleaseGateSummary, releaseGateStatusTone } from './release-gate-summary.model';

const PHASES: ReleaseGatePhase[] = ['commit', 'build', 'deploy', 'promote'];

interface Props {
  catalog: ReleaseGateCatalog;
  dialogId: string;
  open: boolean;
  filterCapabilityIds: readonly string[] | null;
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
  const activeCapability =
    props.filterCapabilityIds && props.filterCapabilityIds.length === 1
      ? props.catalog.capabilities.find((candidate) => candidate.id === props.filterCapabilityIds?.[0])
      : undefined;
  const filteredChecks = props.filterCapabilityIds
    ? props.catalog.checks.filter(
        (check) =>
          check.phase === props.catalog.decisions.build.phase &&
          check.capabilityId &&
          props.filterCapabilityIds?.includes(check.capabilityId),
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
      width={760}
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
        className="space-y-5"
      >
        <p id={`${props.dialogId}-description`} className="text-sm text-muted-foreground">
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
        {/* PX-33：chips 改换行网格，15 组不再横向溢出首屏。 */}
        <div
          role="region"
          tabIndex={0}
          aria-label={t('releaseGateCapabilityGroupsLabel')}
          className="flex flex-wrap gap-2"
        >
          {summary.capabilities.map((group) => {
            const capability = props.catalog.capabilities.find((candidate) => candidate.id === group.id)!;
            const active =
              !props.filterCapabilityIds || props.filterCapabilityIds.includes(group.id);
            return (
              <div
                key={group.id}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs ${
                  active ? 'border-primary/40 bg-primary/5' : 'opacity-60'
                }`}
              >
                <span>
                  <strong className="font-mono">{group.id}</strong> {localize(capability.name)}
                </span>
                <span className="flex items-center gap-2">
                  <StatusTag
                    status={releaseGateStatusTone(group.status)}
                    label={t(`releaseGateStatus.${group.status}`)}
                  />
                  <span className="text-muted-foreground">
                    {t('releaseGatePassingCount', {
                      passing: group.passingCount,
                      total: group.checkCount,
                    })}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div
          role="region"
          tabIndex={0}
          aria-label={t('releaseGateCheckListLabel')}
          className="max-h-[420px] space-y-4 overflow-y-auto pr-1"
        >
          {visiblePhases.map((phase) => (
            <ReleaseGatePhaseSection
              key={phase}
              phase={phase}
              checks={filteredChecks.filter((check) => check.phase === phase)}
              localize={localize}
              locale={locale}
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
