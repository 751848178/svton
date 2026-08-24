'use client';

/**
 * 域名入口「预览配置」弹层（DOM-3）。
 *
 * 单一职责：展示某入口 dry-run 同步计划生成的配置预览（目标路径、警告、
 * 配置差异、Nginx 配置片段）。计划缺失或为空时给出明确反馈而非静默。
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import type { Site, SiteSyncPlan } from '@/app/(dashboard)/sites/types';

export function ProjectDomainsConfigPreview(props: {
  open: boolean;
  site?: Site;
  plan?: SiteSyncPlan;
  loading: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const { plan, loading } = props;
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={t('domainConfigPreviewTitle')}
      width={640}
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {props.site ? `${props.site.primaryDomain} · ${props.site.name}` : ''}
        </p>
        {loading ? (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t('domainConfigPreviewLoading')}
          </p>
        ) : null}
        {!loading && !plan ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {t('domainConfigPreviewEmpty')}
          </p>
        ) : null}
        {plan ? <PlanFacts plan={plan} /> : null}
      </div>
    </Modal>
  );
}

function PlanFacts({ plan }: { plan: SiteSyncPlan }) {
  const t = useTranslations('projects');
  return (
    <>
      {plan.target?.configPath ? (
        <div>
          <p className="text-xs font-medium">{t('domainConfigPreviewTargetPath')}</p>
          <p className="mt-1 break-all font-mono text-xs">{plan.target.configPath}</p>
        </div>
      ) : null}
      {plan.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-medium">{t('domainConfigPreviewWarnings')}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan.configDiff ? (
        <div>
          <p className="text-xs font-medium">{t('domainConfigPreviewDiffSummary')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{plan.configDiff.summary}</p>
        </div>
      ) : null}
      {plan.nginxConfig ? (
        <details className="rounded-md border">
          <summary className="min-h-9 cursor-pointer px-3 py-2 text-xs font-medium">
            {t('domainConfigPreviewNginx')}
          </summary>
          <pre className="max-h-72 overflow-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed">
            {plan.nginxConfig}
          </pre>
        </details>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t('domainConfigPreviewEmpty')}
        </p>
      )}
    </>
  );
}
