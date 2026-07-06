/**
 * 添加站点弹窗 - 反向代理/静态/docker/runtime 配置表单。
 *
 * react-hook-form 样板：取代手写 useState + setFormData 的手搓表单状态。
 * 表单字段经 watch()/setValue 以兼容的 formData/updateFormData shape 透传给
 * AddSiteBasicFields / RuntimeConfigFields 子组件，保持其接口与行为不变。
 */
'use client';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { apiRequest } from '@/lib/api-client';
import type { Server, Project, ProjectEnvironment, ProxyConfig } from '../types';
import { buildRuntimeConfig, splitCsv } from '../utils';
import { AddSiteBasicFields } from './add-site-basic-fields.component';
import type { AddSiteFormData } from './add-site-form.types';
import { RuntimeConfigFields } from './runtime-config-fields';

export function AddSiteModal({
  servers,
  projects,
  projectEnvironments,
  proxyConfigs,
  defaultProjectId,
  defaultEnvironmentId,
  onClose,
  onSuccess,
}: {
  servers: Server[];
  projects: Project[];
  projectEnvironments: ProjectEnvironment[];
  proxyConfigs: ProxyConfig[];
  defaultProjectId: string;
  defaultEnvironmentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('sites');
  const tc = useTranslations('common');
  const { handleSubmit, watch, setValue, setError, formState } = useForm<AddSiteFormData>({
    defaultValues: {
      name: '',
      primaryDomain: '',
      aliases: '',
      runtimeType: 'reverse_proxy',
      upstreamUrl: '',
      rootPath: '',
      containerName: '',
      containerPort: '3000',
      websocket: false,
      tlsEnabled: false,
      tlsType: 'letsencrypt',
      tlsEmail: '',
      allowedCidrs: '',
      basicAuth: false,
      serverId: '',
      projectId: defaultProjectId,
      environmentId: defaultEnvironmentId,
      proxyConfigId: '',
    },
  });

  const formData = watch();
  const updateFormData = (patch: Partial<AddSiteFormData>) => {
    (Object.keys(patch) as (keyof AddSiteFormData)[]).forEach((key) => {
      setValue(key, patch[key] as never);
    });
  };

  const submit = handleSubmit(async (data) => {
    try {
      await apiRequest('POST:/sites', {
        name: data.name,
        primaryDomain: data.primaryDomain,
        aliases: splitCsv(data.aliases),
        runtimeType: data.runtimeType,
        runtimeConfig: buildRuntimeConfig(data),
        tls: {
          enabled: data.tlsEnabled,
          type: data.tlsEnabled ? data.tlsType : 'none',
          email: data.tlsEmail || undefined,
        },
        accessPolicy: {
          allowedCidrs: splitCsv(data.allowedCidrs),
          basicAuth: data.basicAuth,
        },
        serverId: data.serverId || undefined,
        projectId: data.projectId || undefined,
        environmentId: data.environmentId || undefined,
        proxyConfigId: data.proxyConfigId || undefined,
      });
      onSuccess();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : t('addSiteFailed') });
    }
  });

  const error = (formState.errors.root as { message?: string } | undefined)?.message || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{t('addSite')}</h2>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form
          onSubmit={submit}
          className="space-y-4"
        >
          <AddSiteBasicFields
            formData={formData}
            servers={servers}
            projects={projects}
            projectEnvironments={projectEnvironments}
            onChange={updateFormData}
          />
          <RuntimeConfigFields
            formData={formData}
            proxyConfigs={proxyConfigs}
            onChange={updateFormData}
          />
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {formState.isSubmitting ? t('adding') : t('add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
