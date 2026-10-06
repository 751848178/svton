'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FlowStatusTag } from './release-workbench/release-flow-status-tag';
import type {
  LocalizedGateText,
  ReleaseGateCheck,
  ReleaseGatePhase,
} from '../types/release-gate.types';
import { foldTechnicalIds, humanizeEvidenceText } from '../utils/release-display.utils';
import { formatIsoMinute } from '../utils/release-time.utils';
import { releaseGateStatusTone } from './release-gate-summary.model';
import { ReleaseGateManualConfirmation } from './release-gate-manual-confirmation';

interface Props {
  phase: ReleaseGatePhase;
  checks: ReleaseGateCheck[];
  localize: (text: LocalizedGateText) => string;
  locale: string;
  /** 能力组 id → 本地化名称（元数据不再裸显 M 码）。 */
  capabilityName?: (id: string) => string | undefined;
  confirmingGateId: string;
  confirmationError: string;
  onConfirmManual: (gateId: string, evaluationId: string, reason: string) => Promise<boolean>;
}

export function ReleaseGatePhaseSection(props: Props) {
  const t = useTranslations('projects');
  return (
    /* 复核修 2：外层一张阶段卡，内部为「标题+内容」分栏行（divide-y），
        不再嵌套逐项小卡片。 */
    <section
      aria-labelledby={`release-gate-phase-${props.phase}`}
      className="rounded-lg border px-4 py-2"
    >
      <div className="flex items-center justify-between py-2">
        <h3
          id={`release-gate-phase-${props.phase}`}
          className="text-sm font-semibold"
        >
          {t(`releaseGatePhase.${props.phase}`)}
        </h3>
        <span className="text-xs text-muted-foreground">{props.checks.length}</span>
      </div>
      <div className="divide-y divide-border">
        {props.checks.map((check) => (
          <article
            key={check.id}
            className="py-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <span>
                <strong className="font-mono">{check.id}</strong> · {props.localize(check.title)}
              </span>
              <FlowStatusTag
                status={releaseGateStatusTone(check.status)}
                label={t(`releaseGateStatus.${check.status}`)}
              />
            </div>
            <dl className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2">
              <GateMetadata
                label={t('releaseGateProviderLabel')}
                value={check.providerKey || t('releaseGateMetadataUnavailable')}
              />
              <GateMetadata
                label={t('releaseGateReasonLabel')}
                /* ROD-5：reason 内嵌 raw ISO 时间戳本地化；复核补漏：reason 亦可能
                    内嵌完整 cuid（如「Manifest cmsn… 以 Digest 绑定」），统一走组合清洗。 */
                value={humanizeEvidenceText(props.localize(check.reason))}
              />
              <GateMetadata
                label={t('releaseGateEvidenceLabel')}
                /* PX-3：证据串内嵌 cuid 折叠为前 8 位，完整值进 title。 */
                value={check.evidenceRef ? foldTechnicalIds(check.evidenceRef) : t('releaseGateMetadataUnavailable')}
                title={check.evidenceRef ?? undefined}
              />
              <GateMetadata
                label={t('releaseGateCheckedAtLabel')}
                value={formatIsoMinute(check.checkedAt) || t('releaseGateMetadataUnavailable')}
              />
              <GateMetadata
                label={t('releaseGateExpiresAtLabel')}
                value={formatIsoMinute(check.expiresAt) || t('releaseGateMetadataUnavailable')}
              />
              <GateMetadata
                className="max-[820px]:hidden"
                label={t('releaseGateCapabilityLabel')}
                /* PX-12：无能力组的检查显示「—」，不暴露后端原始分类「目标上下文」。 */
                value={check.capabilityId ? props.capabilityName?.(check.capabilityId) || check.capabilityId : '—'}
              />
            </dl>
            {check.status === 'manual' && check.dispositions.includes('manual') ? (
              <ReleaseGateManualConfirmation
                check={check}
                confirming={props.confirmingGateId === check.id}
                error={props.confirmationError}
                onConfirm={props.onConfirmManual}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function GateMetadata({
  label,
  value,
  title,
  className = '',
}: {
  label: string;
  value: string;
  title?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd
        className="break-all"
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}
