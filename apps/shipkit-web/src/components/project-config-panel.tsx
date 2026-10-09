'use client';
import { Server } from 'lucide-react';
import type { LiveProject, Project } from '@/lib/contracts';
import { serverLabel } from '@/lib/presentation';

export function ProjectConfigPanel({ project, live }: { project: Project; live: LiveProject }) {
  const fields = [
    ...(project.sourceKind === 'repository' ? [['仓库', project.repository?.url || '未记录'], ['默认引用', `${project.repository?.ref.kind || 'branch'} · ${project.repository?.ref.value || '仓库默认分支'}`], ['最近读取提交', live.source.commit || '生成计划时固定']] : [['源码分支', live.source.branch || '不可用'], ['提交', live.source.commit || '不可用'], ['工作区', live.source.dirty === null ? '未能读取' : live.source.dirty ? '存在未提交变更' : '干净']]),
    ['目标显示名', serverLabel(project, live)], ['部署目标', live.targetKey],
    ['镜像仓库', live.registry.configured ? `${live.registry.host || ''}${live.registry.namespace ? ` / ${live.registry.namespace}` : ''} · 已配置` : '未配置'],
    ['构建方式', live.builder.mode === 'dynamic' ? '按需创建，用完释放' : '绑定现有构建机'],
    ['运行 Agent', live.runtime.check.version || '版本不可用'],
  ];
  return <aside className="panel"><div className="panel-head"><h2>发布配置</h2></div><dl className="context-list">{fields.map(([label, value]) => <span key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd className={['提交', '源码分支'].includes(label) ? 'mono' : ''}>{value}</dd></span>)}</dl>
    <div className="panel-body builder-state"><Server size={21} aria-hidden="true" /><span>{live.builder.mode === 'dynamic' ? '构建机按发布任务创建' : '现有构建机'}<span className="subtle">镜像仓库配置级别；推拉结果以实际发布为准。</span></span></div>
  </aside>;
}
