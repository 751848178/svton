/** 添加站点弹窗 - 反向代理/静态/docker/runtime 配置表单。 */
'use client';
import { useState } from 'react';
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
  const [formData, setFormData] = useState<AddSiteFormData>({
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const updateFormData = (patch: Partial<AddSiteFormData>) =>
    setFormData((current) => ({ ...current, ...patch }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('POST:/sites', {
        name: formData.name,
        primaryDomain: formData.primaryDomain,
        aliases: splitCsv(formData.aliases),
        runtimeType: formData.runtimeType,
        runtimeConfig: buildRuntimeConfig(formData),
        tls: {
          enabled: formData.tlsEnabled,
          type: formData.tlsEnabled ? formData.tlsType : 'none',
          email: formData.tlsEmail || undefined,
        },
        accessPolicy: {
          allowedCidrs: splitCsv(formData.allowedCidrs),
          basicAuth: formData.basicAuth,
        },
        serverId: formData.serverId || undefined,
        projectId: formData.projectId || undefined,
        environmentId: formData.environmentId || undefined,
        proxyConfigId: formData.proxyConfigId || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加站点失败');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">添加站点</h2>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
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
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
