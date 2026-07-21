import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { ApplicationItem, AppForm, ServiceForm } from '../types';
import { compactObject } from '../utils';

type SetForm<T> = (patch: Partial<T>) => void;

type UseApplicationCreationArgs = {
  appForm: AppForm;
  serviceForm: ServiceForm;
  setAppForm: SetForm<AppForm>;
  setServiceForm: SetForm<ServiceForm>;
  setSaving: (saving: boolean) => void;
  setError: (error: string) => void;
  reload: () => Promise<void>;
};

export function useApplicationCreation({
  appForm,
  serviceForm,
  setAppForm,
  setServiceForm,
  setSaving,
  setError,
  reload,
}: UseApplicationCreationArgs) {
  const t = useTranslations('applications');

  const createApplication = usePersistFn(async () => {
    if (!appForm.projectId || !appForm.name.trim()) {
      // 校验失败走页内 ErrorBanner（setError），不再 alert
      setError(t('createAppValidation'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const application = await apiRequest<ApplicationItem>('POST:/applications', {
        projectId: appForm.projectId,
        name: appForm.name.trim(),
        repositoryUrl: appForm.repositoryUrl || undefined,
        defaultBranch: appForm.defaultBranch || undefined,
        repoPath: appForm.repoPath || undefined,
      });
      setAppForm({ name: '', repoPath: '' });
      setServiceForm({ applicationId: application.id });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建应用失败');
    } finally {
      setSaving(false);
    }
  });

  const createService = usePersistFn(async () => {
    if (!serviceForm.applicationId || !serviceForm.environmentId || !serviceForm.name.trim()) {
      setError(t('createServiceValidation'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const deployConfig = compactObject({
        targetType: serviceForm.kind === 'external' ? 'external-ci' : 'server',
        workingDirectory: serviceForm.workingDirectory,
        buildCommand: serviceForm.buildCommand,
        deployCommand: serviceForm.deployCommand,
        healthCheckUrl: serviceForm.healthCheckUrl,
      });
      await apiRequest(`POST:/applications/${serviceForm.applicationId}/services`, {
        environmentId: serviceForm.environmentId,
        name: serviceForm.name.trim(),
        kind: serviceForm.kind,
        runtime: serviceForm.runtime || undefined,
        serverId: serviceForm.serverId || undefined,
        siteId: serviceForm.siteId || undefined,
        managedResourceId: serviceForm.managedResourceId || undefined,
        deployConfig: Object.keys(deployConfig).length > 0 ? deployConfig : undefined,
      });
      setServiceForm({
        name: '',
        runtime: '',
        siteId: '',
        managedResourceId: '',
        workingDirectory: '',
        buildCommand: '',
        deployCommand: '',
        healthCheckUrl: '',
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建应用服务失败');
    } finally {
      setSaving(false);
    }
  });

  return { createApplication, createService };
}
