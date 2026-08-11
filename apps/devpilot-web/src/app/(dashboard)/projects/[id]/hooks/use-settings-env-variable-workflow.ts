'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import type { ProjectEnvironment } from '../types';
import { diffEnvVars } from '../utils/env-var-diff.utils';
import { useEnvironmentEnvCopy } from './use-environment-env-copy';
import { useEnvironmentEnvVars } from './use-environment-env-vars';

type Translator = ReturnType<typeof useTranslations<'projects'>>;

export function useSettingsEnvVariableWorkflow(
  environment: ProjectEnvironment,
  onSaved: (updated: ProjectEnvironment) => void,
  t: Translator,
) {
  const envVars = useEnvironmentEnvVars(environment, onSaved);
  const envCopy = useEnvironmentEnvCopy(environment.id);
  const [importOpen, setImportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    envVars.reset();
    // Reset only when switching environment; reset is intentionally stable by id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment.id]);

  const diff = useMemo(
    () => diffEnvVars(envVars.vars, envVars.draft),
    [envVars.vars, envVars.draft],
  );
  const updateRow = (oldKey: string, field: 'key' | 'value', value: string) => {
    const next: Record<string, string> = {};
    for (const [key, currentValue] of Object.entries(envVars.draft)) {
      if (key === oldKey) next[field === 'key' ? value : key] = field === 'value' ? value : currentValue;
      else next[key] = currentValue;
    }
    envVars.setDraft(next);
  };
  const addRow = () => {
    let index = 1;
    while (envVars.draft[`NEW_KEY_${index}`] !== undefined) index += 1;
    envVars.setDraft({ ...envVars.draft, [`NEW_KEY_${index}`]: '' });
  };
  const removeRow = (key: string) => {
    const next = { ...envVars.draft };
    delete next[key];
    envVars.setDraft(next);
  };
  const importVars = (incoming: Record<string, string>) => {
    envVars.mergeDraft(incoming);
    feedback.success(t('envImportApplied', { count: Object.keys(incoming).length }));
  };
  const deploy = async () => {
    setDeploying(true);
    try {
      await envVars.save();
      feedback.success(t('envVarsSaveSuccess'));
      setReviewOpen(false);
    } catch (cause) {
      feedback.error(t('envVarsSaveFailed'), {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setDeploying(false);
    }
  };
  const discard = () => {
    envVars.reset();
    feedback.success(t('stagedDiscarded'));
  };
  return {
    ...envVars, ...envCopy, diff, updateRow, addRow, removeRow, importVars, deploy, discard,
    importOpen, setImportOpen, reviewOpen, setReviewOpen, copyOpen, setCopyOpen, deploying,
  };
}
