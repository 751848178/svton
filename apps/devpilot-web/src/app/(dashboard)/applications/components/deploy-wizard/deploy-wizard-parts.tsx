/**
 * 部署向导 - 辅助子组件（步骤指示器 / 结果区 / 底部操作栏）
 *
 * 单一职责：从 deploy-wizard-modal 拆出的纯展示 + 操作编排组件，保持每个文件 ≤200 行。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { CreatedDeploymentRun } from '../../types';
import { DeployRunStatusBadge } from '../deploy-run-status-badge';
import { DeployWizardLiveConfirm } from './deploy-wizard-live-confirm';

type AppsTranslator = ReturnType<typeof useTranslations<'applications'>>;
type CommonTranslator = ReturnType<typeof useTranslations<'common'>>;

/** 顶部 1·2·3 步骤指示器。 */
export function WizardStepIndicator({ t, step }: { t: AppsTranslator; step: string }) {
  const steps: Array<{ key: string; label: string }> = [
    { key: 'environment', label: t('wizardStepEnvironment') },
    { key: 'preview', label: t('wizardStepPreview') },
    { key: 'action', label: t('wizardStepAction') },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, idx) => (
        <span
          key={s.key}
          className={
            idx <= activeIdx ? 'font-medium text-primary' : 'text-muted-foreground'
          }
        >
          {idx + 1}. {s.label}
          {idx < steps.length - 1 ? ' · ' : ''}
        </span>
      ))}
    </div>
  );
}

/** Step 3 成功结果区：状态徽章 + 审批跳转链接 + 关闭。 */
export function WizardResult({
  run,
  onClose,
  t,
  tc,
}: {
  run: CreatedDeploymentRun;
  onClose: () => void;
  t: AppsTranslator;
  tc: CommonTranslator;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <p className="text-sm font-medium">{t('wizardLiveRequestedHint')}</p>
      <DeployRunStatusBadge run={run} />
      {run.operationApproval ? (
        <Link
          href="/operation-approvals"
          className="inline-block text-sm text-primary hover:underline"
        >
          {t('wizardGoApprovals')} #{run.operationApproval.id.slice(0, 8)}
        </Link>
      ) : null}
      <div className="flex justify-end">
        <Button size="sm" onClick={onClose}>
          {tc('close')}
        </Button>
      </div>
    </div>
  );
}

export interface WizardFooterProps {
  t: AppsTranslator;
  tc: CommonTranslator;
  step: string;
  showLiveForm: boolean;
  submitting: boolean;
  environmentName: string;
  projectName: string;
  onPrev: () => void;
  onGeneratePreview: () => void;
  onShowLiveForm: () => void;
  onClose: () => void;
  onRequestLive: (confirmationText: string, approvalReason: string) => void;
}

/** 底部操作栏：随当前步骤切换按钮（生成预览 / 返回 / 申请 live / live 确认表单）。 */
export function WizardFooter(props: WizardFooterProps) {
  const { t, tc, step, showLiveForm, submitting, environmentName, projectName } = props;
  // action 步骤已由 WizardResult 自带关闭按钮，底部不再渲染操作。
  if (step === 'action') return null;

  if (step === 'preview' && showLiveForm) {
    return (
      <DeployWizardLiveConfirm
        projectName={projectName}
        environmentName={environmentName}
        submitting={submitting}
        onSubmit={props.onRequestLive}
        onCancel={props.onPrev}
      />
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
      <Button variant="outline" size="sm" onClick={props.onClose}>
        {tc('cancel')}
      </Button>
      {step === 'environment' ? (
        <Button size="sm" onClick={props.onGeneratePreview} disabled={submitting}>
          {submitting ? tc('processing') : t('wizardGeneratePreview')}
        </Button>
      ) : null}
      {step === 'preview' ? (
        <>
          <Button variant="outline" size="sm" onClick={props.onPrev}>
            {tc('back')}
          </Button>
          <Button size="sm" onClick={props.onShowLiveForm}>
            {t('wizardRequestLive')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
