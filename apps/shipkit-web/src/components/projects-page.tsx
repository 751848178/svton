'use client';
import { useState } from 'react';
import { ArrowRight, Box, Plus } from 'lucide-react';
import type { Project } from '@/lib/contracts';
import { useApi } from '@/hooks/use-api';
import { serverLabel, time } from '@/lib/presentation';
import { EmptyPanel, ErrorMessage, LoadingPanel, PageHead, Status } from './primitives';
import { ProjectRegistrationModal } from './project-registration';

function ProjectRow({ project, onOpen }: { project: Project; onOpen: (id: string) => void }) {
  const status = useApi('GET:/projects/:id/status', { id: project.id });
  const tasks = useApi('GET:/projects/:id/tasks', { id: project.id });
  const latest = tasks.data?.items[0];
  return <tr><td><div className="project-name"><span className="project-icon"><Box size={23} aria-hidden="true" /></span><div>
    <button className="project-entry" onClick={() => onOpen(project.id)} aria-label={`进入 ${project.name} 项目详情`}><strong>{project.name}</strong></button><p className="project-description">{project.rootPath}</p>
  </div></div></td><td data-label="部署目标"><span className="server-address">{serverLabel(project, status.data?.live)}</span><p className="subtle">{status.data?.live.targetKey || (status.error ? '连接读取失败' : project.targetKey || '连接读取中…')}</p></td>
    <td data-label="应用服务">{(status.data?.live.services ?? project.services).map(service => <span className="service-pill" key={service.serviceKey}>{service.serviceKey}</span>)}</td>
    <td data-label="最新发布">{latest && <strong title={`任务 ID：${latest.id}`}>{latest.version}</strong>} <Status value={latest?.status} /><p className="subtle">{time(latest?.createdAt)}</p></td>
    <td><button className="button secondary small" onClick={() => onOpen(project.id)}>进入项目 <ArrowRight size={16} aria-hidden="true" /></button></td>
  </tr>;
}
export function ProjectsPage({ onOpen }: { onOpen: (id: string) => void }) {
  const projects = useApi('GET:/projects', {});
  const [registerOpen, setRegisterOpen] = useState(false);
  return <>
    <PageHead title="项目" description="选择一个项目，查看服务并开始发布。"><button className="button primary" onClick={() => setRegisterOpen(true)}><Plus size={16} aria-hidden="true" />注册项目</button></PageHead>
    <ErrorMessage error={projects.error} />
    {projects.isLoading ? <LoadingPanel text="正在读取已注册的本机项目…" /> : !projects.data?.items.length ? <EmptyPanel text="还没有注册项目。绑定本机目录和配置文件后即可读取真实状态。"><button className="button primary" onClick={() => setRegisterOpen(true)}>注册本机项目</button></EmptyPanel> :
      <section className="panel"><div className="panel-head"><h2>本机项目</h2><span className="subtle">{projects.data.items.length} 个项目 · 已保存的连接与发布配置</span></div><div className="table-wrap"><table className="project-list"><thead><tr><th>项目</th><th>部署目标</th><th>应用服务</th><th>最新发布</th><th></th></tr></thead><tbody>{projects.data.items.map(project => <ProjectRow key={project.id} project={project} onOpen={onOpen} />)}</tbody></table></div></section>}
    <ProjectRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onSaved={project => { void projects.mutate(); onOpen(project.id); }} />
  </>;
}
