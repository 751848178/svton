/**
 * 部署向导弹窗（多步容器）
 *
 * 单一职责：组合 3 步组件 + 编排状态机 + 成功反馈（toast + 结果区）。
 * 取代 service-row 原先的 fire-and-forget「生成部署计划」按钮。
 *
 * 步骤流转：
 *   environment ──[生成预览]──▶ preview ──[申请 Live]──▶ action(live confirm → 结果区)
 *                  │                         │
 *                  └──(仅生成计划, 关闭)      └──(成功 → 状态徽章 + 审批跳转链接)
 *
 * 辅助子组件（指示器/结果区/底部栏）见 deploy-wizard-parts.tsx。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import { Modal, ErrorBanner } from '@/components/ui';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  CreatedDeploymentRun,
  ProjectEnvironment,
} from '../../types';
import { useDeployWizard } from './use-deploy-wizard';
import { DeployWizardEnvironmentStep } from './deploy-wizard-environment-step';
import { DeployWizardPlanPreview } from './deploy-wizard-plan-preview';
import { WizardStepIndicator, WizardResult, WizardFooter } from './deploy-wizard-parts';

interface DeployWizardModalProps {
  open: boolean;
  onClose: () => void;
  application: ApplicationItem;
  service: ApplicationServiceItem;
  environments: ProjectEnvironment[];
  createPlan: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    options?: { environmentId?: string; serverId?: string; branch?: string },
  ) => Promise<CreatedDeploymentRun>;
  requestApproval: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    input: {
      confirmationText: string;
      approvalReason?: string;
      environmentId?: string;
      serverId?: string;
      branch?: string;
    },
  ) => Promise<CreatedDeploymentRun>;
}

export function DeployWizardModal({
  open,
  onClose,
  application,
  service,
  environments,
  createPlan,
  requestApproval,
}: DeployWizardModalProps) {
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  const wizard = useDeployWizard({ application, service, createPlan, requestApproval });
  const [showLiveForm, setShowLiveForm] = useState(false);

  const handleClose = () => {
    setShowLiveForm(false);
    wizard.reset();
    onClose();
  };

  const handleGeneratePreview = async () => {
    const run = await wizard.generatePreview();
    if (run) feedback.success(t('wizardPreviewReady'));
  };

  const handleRequestLive = async (confirmationText: string, approvalReason: string) => {
    const run = await wizard.submitLive(confirmationText, approvalReason);
    if (run) feedback.success(t('wizardLiveRequested'));
  };

  const projectName = application.project?.name || application.name;
  const environmentName =
    environments.find((e) => e.id === wizard.input.environmentId)?.name ||
    service.environment?.name ||
    '';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('wizardTitle', { service: service.name })}
      width={560}
    >
      <div className="space-y-4">
        <WizardStepIndicator t={t} step={wizard.step} />
        {wizard.error ? <ErrorBanner message={wizard.error} variant="inline" /> : null}

        {wizard.step === 'environment' ? (
          <DeployWizardEnvironmentStep
            application={application}
            service={service}
            environments={environments}
            selectedEnvironmentId={wizard.input.environmentId}
            onSelect={(id) => wizard.updateInput({ environmentId: id })}
          />
        ) : null}

        {wizard.step === 'preview' ? (
          <DeployWizardPlanPreview run={wizard.previewRun} />
        ) : null}

        {wizard.step === 'action' && wizard.resultRun ? (
          <WizardResult run={wizard.resultRun} onClose={handleClose} t={t} tc={tc} />
        ) : null}

        <WizardFooter
          t={t}
          tc={tc}
          step={wizard.step}
          showLiveForm={showLiveForm}
          submitting={wizard.submitting}
          environmentName={environmentName}
          projectName={projectName}
          onPrev={() => {
            if (showLiveForm) setShowLiveForm(false);
            else wizard.setStep('environment');
          }}
          onGeneratePreview={handleGeneratePreview}
          onShowLiveForm={() => setShowLiveForm(true)}
          onClose={handleClose}
          onRequestLive={handleRequestLive}
        />
      </div>
    </Modal>
  );
}
