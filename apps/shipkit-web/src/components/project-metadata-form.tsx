'use client';
import { useEffect, useState } from 'react';
import { Select } from '@svton/ui';
import { useForm } from 'react-hook-form';
import type { LiveProject, Project } from '@/lib/contracts';
import { request } from '@/lib/api';
import { metadataInput, type MetadataFormValues } from '@/lib/project-input';
import { ErrorMessage } from './primitives';

export function ProjectMetadataForm({ project, live, onSaved }: { project: Project; live: LiveProject; onSaved: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<MetadataFormValues>();
  const serviceKeys = live.services.map(service => service.serviceKey).join('|');
  useEffect(() => {
    form.reset({ name: project.name, serverName: project.serverName || '', targetKey: project.targetKey || live.targetKey,
      services: live.services.map(service => {
        const existing = project.services.find(item => item.serviceKey === service.serviceKey);
        return { serviceKey: service.serviceKey, displayName: existing?.displayName || '', entryUrl: existing?.entryUrl || '' };
      }),
    });
  }, [project.id, project.updatedAt, serviceKeys]);
  const submit = form.handleSubmit(async values => {
    setError(null); setSaved(false);
    try { await request('PATCH:/projects/:id', { id: project.id, ...metadataInput(values) }); setSaved(true); onSaved(); }
    catch (failure) { setError(failure); }
  });
  const selectTarget = (targetKey: string) => {
    form.setValue('targetKey', targetKey, { shouldDirty: true });
    form.setValue('serverName', project.targets?.find(target => target.targetKey === targetKey)?.displayName || '', { shouldDirty: true });
  };
  return <section className="panel"><div className="panel-head"><div><h2>显示名称与服务入口</h2><p className="subtle">显示名称和入口地址由你手动维护；部署目标和服务标识从项目配置文件读取。</p></div></div><div className="panel-body">
    <form className="config-form" onSubmit={submit}><ErrorMessage error={error} />
      {saved && <p className="subtle" role="status">项目显示信息与目标选择已保存。</p>}
      <label>项目名称<input {...form.register('name', { required: true })} /></label>
      <div className="select-field"><label htmlFor="metadata-target">本项目的部署目标</label><Select id="metadata-target" options={live.targets.map(target => ({ value: target.targetKey, label: `${target.targetKey} · ${project.targets?.find(item => item.targetKey === target.targetKey)?.displayName || target.url}` }))}
        value={form.watch('targetKey') || live.targetKey} onChange={event => selectTarget(event.target.value)} />
        <p className="form-help">选择配置文件中的已有目标并保存后生效；有发布任务执行时不能切换目标。服务器资源和连接地址由配置文件维护。</p>
      </div>
      <label>目标显示名称<input {...form.register('serverName')} /><span className="form-help">手动填写，仅作为所选部署目标的识别名称，不修改 Agent 地址。</span></label>
      <div className="metadata-services">{live.services.map((service, index) => <div key={service.serviceKey} className="config-form"><h3>{service.serviceKey}</h3>
        <input type="hidden" {...form.register(`services.${index}.serviceKey`)} />
        <label>服务显示名称<input {...form.register(`services.${index}.displayName`)} /><span className="form-help">手动填写；{service.serviceKey} 是配置文件中的固定服务标识。</span></label>
        <label>服务入口 URL<input type="url" {...form.register(`services.${index}.entryUrl`, { validate: value => !value || /^https?:\/\//.test(value) || '使用 http:// 或 https:// 地址' })} placeholder="https://…" />
          <span className="form-help">手动填写浏览器访问地址，可使用域名或 IP 和端口；平台不会自动推断、配置 DNS 或反向代理。</span>{form.formState.errors.services?.[index]?.entryUrl && <span className="form-error">{form.formState.errors.services[index]?.entryUrl?.message}</span>}</label>
      </div>)}</div>
      <div className="form-actions"><button className="button primary" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? '正在保存…' : '保存配置'}</button></div>
    </form>
  </div></section>;
}
