'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import { siteEntryFormValid, validateSiteEntryForm } from '@/app/(dashboard)/sites/domain-format.utils';
import type { Site } from '@/app/(dashboard)/sites/types';
import type { ConfigRevisionDraft } from '../hooks/use-environment-config-governance';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';
import type { ProjectApplication, ProjectEnvironment } from '../types';
import {
  buildProjectDomainTargets,
  domainExists,
  initialDomainWorkflowForm,
} from './project-domain-workflow.model';
import {
  persistProjectDomainWorkflow,
  type DomainWorkflowCompletion,
} from './project-domain-workflow-submit';
import { ProjectDomainWorkflowSteps } from './project-domain-workflow-steps';

const EMPTY_COMPLETION: DomainWorkflowCompletion = { site: false, binding: false, revision: false };

export function ProjectDomainWorkflowModal(props: {
  projectId: string;
  projectName: string;
  environment: ProjectEnvironment;
  applications: ProjectApplication[];
  sites: Site[];
  currentRevision: EnvironmentConfigRevision | null;
  site?: Site | null;
  saveRevision: (draft: ConfigRevisionDraft) => Promise<unknown>;
  onChanged: () => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const allTargets = useMemo(
    () => buildProjectDomainTargets(props.applications, props.environment.id),
    [props.applications, props.environment.id],
  );
  const boundTarget = props.site
    ? allTargets.find((target) => target.siteId === props.site?.id) ?? null
    : null;
  const targets = props.site
    ? allTargets.filter((target) => !target.siteId || target.siteId === props.site?.id)
    : allTargets.filter((target) => !target.siteId);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => initialDomainWorkflowForm({
    site: props.site,
    targets,
    revision: props.currentRevision,
  }));
  const [createdSite, setCreatedSite] = useState<Site | null>(null);
  const [completion, setCompletion] = useState<DomainWorkflowCompletion>(EMPTY_COMPLETION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStep(1);
    setForm(initialDomainWorkflowForm({ site: props.site, targets, revision: props.currentRevision }));
    setCreatedSite(null);
    setCompletion(EMPTY_COMPLETION);
    setError('');
    // Opening a different object resets the workflow; live target refresh must not erase partial progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.site?.id]);

  const target = targets.find((item) => item.key === form.targetKey) ?? null;
  const issues = validateSiteEntryForm(form);
  const duplicate = domainExists(props.sites, form.primaryDomain, props.site?.id);
  const canContinue = step === 1
    ? Boolean(target && form.path.trim())
    : step === 2
      ? siteEntryFormValid(issues) && !duplicate
      : Boolean(form.changeReason.trim());
  const targetLocked = Boolean(boundTarget || completion.binding);

  const submit = async () => {
    if (!target || !canContinue) return;
    setSaving(true);
    setError('');
    try {
      await persistProjectDomainWorkflow({
        projectId: props.projectId,
        environmentId: props.environment.id,
        form,
        target,
        currentRevision: props.currentRevision,
        originalSite: props.site,
        createdSite,
        completion,
        request: apiRequest,
        saveRevision: props.saveRevision,
        onProgress: (next, persisted) => {
          setCompletion(next);
          if (!props.site) setCreatedSite(persisted);
        },
      });
      feedback.success(t(props.site ? 'domainWorkflowEditSuccess' : 'domainWorkflowCreateSuccess'));
      props.onSuccess();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t('domainWorkflowSaveFailed');
      setError(message);
      props.onChanged();
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!canContinue) return;
    if (step < 3) setStep((value) => value + 1);
    else void submit();
  };

  return (
    <Modal
      open
      onClose={props.onClose}
      maskClosable={!saving}
      closeOnEscape={!saving}
      title={t(props.site ? 'domainWorkflowEditTitle' : 'domainWorkflowCreateTitle')}
      description={t('domainWorkflowDescription')}
      width={720}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={step === 1 ? props.onClose : () => setStep((value) => value - 1)}>
            {step === 1 ? tc('cancel') : t('domainWorkflowBack')}
          </Button>
          <Button disabled={!canContinue || saving} onClick={next}>
            {saving ? tc('saving') : step === 3 ? t('domainWorkflowSubmit') : t('domainWorkflowNext')}
          </Button>
        </>
      }
    >
      {error ? <WorkflowError error={error} completion={completion} /> : null}
      {step === 2 && (issues.name || issues.primaryDomain || issues.invalidAlias || duplicate) ? (
        <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {duplicate ? t('domainWorkflowDuplicateDomain') : t('domainWorkflowInvalidDomain')}
        </p>
      ) : null}
      <ProjectDomainWorkflowSteps
        step={step}
        form={form}
        targets={targets}
        selectedTarget={target}
        projectName={props.projectName}
        environmentLabel={`${props.environment.name} (${props.environment.key})`}
        site={props.site ?? createdSite}
        targetLocked={targetLocked}
        onChange={(patch) => setForm((value) => ({ ...value, ...patch }))}
      />
    </Modal>
  );
}

function WorkflowError({ error, completion }: { error: string; completion: DomainWorkflowCompletion }) {
  const t = useTranslations('projects');
  const completed = [completion.site && t('domainWorkflowSavedSite'), completion.binding && t('domainWorkflowSavedBinding')].filter(Boolean).join('、');
  return (
    <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <p className="font-medium text-destructive">{t('domainWorkflowSaveFailed')}</p>
      <p className="mt-1 break-words">{error}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {completed ? t('domainWorkflowPartialSaved', { completed }) : t('domainWorkflowNothingSaved')}
      </p>
    </div>
  );
}
