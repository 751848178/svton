/** Basic AddSiteModal fields before runtime/TLS configuration. */

import type { Project, ProjectEnvironment, Server, SiteRuntimeType } from '../types';
import type { AddSiteFormData } from './add-site-form.types';

interface AddSiteBasicFieldsProps {
  formData: AddSiteFormData;
  servers: Server[];
  projects: Project[];
  projectEnvironments: ProjectEnvironment[];
  onChange: (patch: Partial<AddSiteFormData>) => void;
}

export function AddSiteBasicFields({
  formData,
  servers,
  projects,
  projectEnvironments,
  onChange,
}: AddSiteBasicFieldsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">站点名称</label>
          <input
            value={formData.name}
            onChange={(event) => onChange({ name: event.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="生产站点"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">主域名</label>
          <input
            value={formData.primaryDomain}
            onChange={(event) => onChange({ primaryDomain: event.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="app.example.com"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">域名别名</label>
        <input
          value={formData.aliases}
          onChange={(event) => onChange({ aliases: event.target.value })}
          className="w-full rounded-md border px-3 py-2"
          placeholder="www.example.com, api.example.com"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">运行时类型</label>
          <select
            value={formData.runtimeType}
            onChange={(event) => onChange({ runtimeType: event.target.value as SiteRuntimeType })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="reverse_proxy">反向代理</option>
            <option value="static">静态站点</option>
            <option value="docker">Docker 服务</option>
            <option value="runtime">运行时服务</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">目标服务器</label>
          <select
            value={formData.serverId}
            onChange={(event) => onChange({ serverId: event.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">不关联服务器</option>
            {servers.map((server) => (
              <option
                key={server.id}
                value={server.id}
              >
                {server.name} ({server.host})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">关联项目</label>
          <select
            value={formData.projectId}
            onChange={(event) => onChange({ projectId: event.target.value, environmentId: '' })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">不关联项目</option>
            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">项目环境</label>
        <select
          value={formData.environmentId}
          onChange={(event) => onChange({ environmentId: event.target.value })}
          className="w-full rounded-md border px-3 py-2"
          disabled={!formData.projectId}
        >
          <option value="">不绑定环境</option>
          {projectEnvironments
            .filter(
              (environment) =>
                environment.projectId === formData.projectId && environment.status !== 'archived',
            )
            .map((environment) => (
              <option
                key={environment.id}
                value={environment.id}
              >
                {environment.name} ({environment.key})
              </option>
            ))}
        </select>
      </div>
    </>
  );
}
