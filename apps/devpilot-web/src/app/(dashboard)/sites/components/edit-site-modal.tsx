/**
 * 编辑站点弹窗 — 复用 AddSiteBasicFields + RuntimeConfigFields,
 * 预填站点现有值,提交走 PUT /sites/:id(后端 UpdateSiteDto 已支持)。
 *
 * 单一职责:编辑态的预填 + 提交;字段渲染完全复用新增表单组件。
 */
'use client';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { Server, Project, ProjectEnvironment, ProxyConfig, Site } from '../types';
import { buildRuntimeConfig, splitCsv, readString, readBoolean, readStringArray } from '../utils';
import { AddSiteBasicFields } from './add-site-basic-fields.component';
import type { AddSiteFormData } from './add-site-form.types';
import { RuntimeConfigFields } from './runtime-config-fields';

interface EditSiteModalProps {
  site: Site;
  servers: Server[];
  projects: Project[];
  projectEnvironments: ProjectEnvironment[];
  proxyConfigs: ProxyConfig[];
  onClose: () => void;
  onSuccess: () => void;
}

/** 把已存在的 Site 反向解析回表单 shape(预填)。 */
function siteToFormData(site: Site): AddSiteFormData {
  const rc = (site.runtimeConfig ?? {}) as Record<string, unknown>;
  const tls = (site.tls ?? {}) as Record<string, unknown>;
  const ap = (site.accessPolicy ?? {}) as Record<string, unknown>;
  return {
    name: site.name,
    primaryDomain: site.primaryDomain,
    aliases: readStringArray(site.aliases).join(', '),
    runtimeType: site.runtimeType,
    upstreamUrl: readString(rc.upstreamUrl) || readString(rc.host) || '',
    rootPath: readString(rc.rootPath) || '',
    containerName: readString(rc.containerName) || '',
    containerPort: readString(rc.containerPort) || '3000',
    websocket: readBoolean(rc.websocket),
    tlsEnabled: readBoolean(tls.enabled),
    tlsType: readString(tls.type) || 'letsencrypt',
    tlsEmail: readString(tls.email) || '',
    allowedCidrs: readStringArray(ap.allowedCidrs).join(', '),
    basicAuth: readBoolean(ap.basicAuth),
    serverId: site.server?.id || '',
    projectId: site.project?.id || '',
    environmentId: site.environment?.id || '',
    proxyConfigId: site.proxyConfig?.id || '',
  };
}

export function EditSiteModal({
  site,
  servers,
  projects,
  projectEnvironments,
  proxyConfigs,
  onClose,
  onSuccess,
}: EditSiteModalProps) {
  const t = useTranslations('sites');
  const tc = useTranslations('common');
  const { handleSubmit, watch, setValue, setError, formState } = useForm<AddSiteFormData>({
    defaultValues: siteToFormData(site),
  });

  const formData = watch();
  const updateFormData = (patch: Partial<AddSiteFormData>) => {
    (Object.keys(patch) as (keyof AddSiteFormData)[]).forEach((key) => {
      setValue(key, patch[key] as never);
    });
  };

  const submit = handleSubmit(async (data) => {
    try {
      await apiRequest(`PUT:/sites/${site.id}`, {
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
      });
      feedback.success(t('editSiteSuccess'));
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('editSiteFailed');
      setError('root', { message: msg });
      feedback.error(t('editSiteFailed'), { description: msg });
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
        <h2 className="mb-4 text-lg font-semibold">{t('editSite')}</h2>
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
              {formState.isSubmitting ? tc('saving') : tc('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
