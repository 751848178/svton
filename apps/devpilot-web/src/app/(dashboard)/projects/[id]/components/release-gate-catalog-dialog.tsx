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
  const locale = useLocale();
  const summary = buildReleaseGateSummary(props.catalog);
  const localize = (text: LocalizedGateText) => (locale.startsWith('zh') ? text.zh : text.en);
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
      title={t('releaseGateCatalogDialogTitle', { count: filteredChecks.length })}
      ariaCloseLabel={t('releaseGateCancel')}
      ariaDescriptionId={`${props.dialogId}-description`}
      width={760}
      footer={
        <>
          <Button
            className="min-h-11"
            variant="ghost"
            onClick={props.onClose}
          >
            {t('releaseGateCancel')}
          </Button>
          <Button className="min-h-11" onClick={props.onClose}>
            {t('releaseGateClose')}
          </Button>
        </>
      }
    >
      <div
        id={props.dialogId}
        className="space-y-5"
      >
        <p id={`${props.dialogId}-description`} className="text-sm text-muted-foreground">
          {t('releaseGateCatalogDialogDescription')}
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
        <div
          role="region"
          tabIndex={0}
          aria-label={t('releaseGateCapabilityGroupsLabel')}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {summary.capabilities.map((group) => {
            const capability = props.catalog.capabilities.find((candidate) => candidate.id === group.id)!;
            return (
              <div
                key={group.id}
                className="flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs"
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
