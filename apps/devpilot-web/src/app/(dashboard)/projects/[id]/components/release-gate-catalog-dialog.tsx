'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { Modal, StatusTag } from '@/components/ui';
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
  onClose: () => void;
}

export function ReleaseGateCatalogDialog({ catalog, dialogId, open, onClose }: Props) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const summary = buildReleaseGateSummary(catalog);
  const localize = (text: LocalizedGateText) => (locale.startsWith('zh') ? text.zh : text.en);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('releaseGateCatalogDialogTitle', { count: catalog.summary.total })}
      width={760}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
          >
            {t('releaseGateCancel')}
          </Button>
          <Button onClick={onClose}>{t('releaseGateClose')}</Button>
        </>
      }
    >
      <div
        id={dialogId}
        className="space-y-5"
      >
        <p className="text-sm text-muted-foreground">{t('releaseGateCatalogDialogDescription')}</p>
        <dl className="grid grid-cols-2 gap-3 min-[821px]:grid-cols-4">
          {PHASES.map((phase) => (
            <div
              key={phase}
              className="rounded-lg border bg-muted/20 px-4 py-3"
            >
              <dt className="text-xs text-muted-foreground">{t(`releaseGatePhase.${phase}`)}</dt>
              <dd className="mt-1 font-semibold">
                {t('releaseGateCheckCount', { count: catalog.summary.phaseCounts[phase] })}
              </dd>
            </div>
          ))}
        </dl>
        <div
          aria-label={t('releaseGateCapabilityGroupsLabel')}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {summary.capabilities.map((group) => {
            const capability = catalog.capabilities.find((candidate) => candidate.id === group.id)!;
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
        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {PHASES.map((phase) => (
            <ReleaseGatePhaseSection
              key={phase}
              phase={phase}
              checks={catalog.checks.filter((check) => check.phase === phase)}
              localize={localize}
              locale={locale}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
