/**
 * 项目接入数据 Hook
 *
 * 单一职责：管理表单状态（useSetState）+ 提交接入。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import type { FormEvent } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ImportProjectForm, EnvironmentKey, CreatedProject } from '../types';
import { INITIAL_FORM } from '../types';
import { buildProjectConfig, trimmed } from '../utils';

export function useImportProject() {
  const t = useTranslations('projects');
  const [form, setForm] = useSetState<ImportProjectForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleEnvironment = usePersistFn((environment: EnvironmentKey) => {
    setForm((current) => {
      const exists = current.environments.includes(environment);
      if (exists && current.environments.length === 1) return current;
      return {
        ...current,
        environments: exists
          ? current.environments.filter((item) => item !== environment)
          : [...current.environments, environment],
      };
    });
  });

  const submit = usePersistFn(async (event: FormEvent<HTMLFormElement>): Promise<string | null> => {
    event.preventDefault();
    setError('');
    const name = form.name.trim();
    if (!name) {
      setError(t('importNameRequired'));
      return null;
    }
    setSubmitting(true);
    try {
      const config = buildProjectConfig(form, name);
      const project = await apiRequest<CreatedProject>('POST:/projects', {
        name,
        description: trimmed(form.description),
        gitRepo: trimmed(form.gitRepo),
        origin: config.origin,
        config,
      });
      return project.id;
    } catch (submitError) {
      console.error('Failed to import project:', submitError);
      setError(submitError instanceof Error ? submitError.message : t('importFailed'));
      return null;
    } finally {
      setSubmitting(false);
    }
  });

  return { form, setForm, submitting, error, toggleEnvironment, submit };
}
