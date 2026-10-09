'use client';
import { useEffect, useState } from 'react';
import { Box, Check, Server } from 'lucide-react';
import type { LiveProject, Project } from '@/lib/contracts';
import { request } from '@/lib/api';
import { diagnosticLabel, serverLabel, verificationLevel } from '@/lib/presentation';
import { ErrorMessage, Status } from './primitives';
import { ProjectMetadataForm } from './project-metadata-form';
import { currentProjectChecks, type ScopedChecks } from '@/lib/project-check-scope';

export function ProjectConnectionsSettings({ project, live, onRefresh }: { project: Project; live: LiveProject; onRefresh: () => void }) {
  const [result, setResult] = useState<ScopedChecks | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ scope: string; value: unknown } | null>(null);
  const scope = JSON.stringify([project.id, project.configPath, project.targetKey || live.targetKey]);
  useEffect(() => { setResult(null); setError(null); }, [scope]);
  const check = async () => {
    setBusy(true); setError(null);
    try { setResult({ scope, value: await request('POST:/projects/:id/checks', { id: project.id }) }); onRefresh(); }
    catch (failure) { setError({ scope, value: failure }); }
    finally { setBusy(false); }
  };
  const checks = currentProjectChecks(result, scope, live.targetKey);
  const current = checks?.live || live;
  return <>
    <div className="settings-module-head"><h2>运行连接 · {current.targetKey}</h2>
      <button className="button primary" onClick={check} disabled={busy}><Check size={16} aria-hidden="true" />{busy ? '正在检查…' : '检查配置'}</button>
    </div><ErrorMessage error={error?.scope === scope ? error.value : null} />
    <section className="panel"><div className="panel-head"><div><h2>当前项目的连接</h2><p className="subtle">配置文件定义了 {current.targets.length} 个可选部署目标；本页检查当前选中的 {current.targetKey}，一次发布写入一个目标。</p></div></div><div className="settings-list">
      <div className="setting-row"><div className="service-name"><Server size={18} aria-hidden="true" /><div><strong>部署目标 · {current.targetKey}</strong><p className="service-copy">{serverLabel(project, current)} · Agent {current.runtime.check.version || '版本不可用'}</p><p className="checks-detail">Agent 连接地址：<span className="mono">{current.runtime.url}</span></p><p className="checks-detail">连接地址可使用本机转发或 SSH 隧道，地址主机名不代表实际服务器 IP。</p>{current.runtime.check.error && <p className="checks-detail">{current.runtime.check.error}</p>}</div></div><Status value={current.runtime.check.ok ? 'succeeded' : 'failed'} label={current.runtime.check.ok ? `连接已确认 · Docker ${current.runtime.check.docker ? '可用' : '不可用'}` : '连接检查失败'} /></div>
      <div className="setting-row"><div className="service-name"><Box size={18} aria-hidden="true" /><div><strong>镜像仓库</strong><p className="service-copy">{[current.registry.host, current.registry.namespace].filter(Boolean).join(' / ') || '未配置'}</p><p className="checks-detail">实际构建、推送与运行端拉取的结果随发布记录保存。</p></div></div><Status value={null} label={current.registry.configured ? '已配置 · 尚未验证推拉' : '未配置'} /></div>
      <div className="setting-row"><div className="service-name"><Server size={18} aria-hidden="true" /><div><strong>{current.builder.mode === 'dynamic' ? '动态构建机' : '现有构建机'}</strong><p className="service-copy">{current.builder.mode === 'dynamic' ? '发布时按需创建；任务中记录资源释放结果' : current.builder.url || '地址不可用'}</p></div></div><Status value={current.builder.check ? current.builder.check.ok ? 'succeeded' : 'failed' : null} label={current.builder.check ? current.builder.check.ok ? `连接已确认 · Agent ${current.builder.check.version || '版本未知'}` : '连接检查失败' : '按需创建 · 尚未检查'} /></div>
      {checks?.checks.map(item => <div className="setting-row" key={item.name}><div><strong>{diagnosticLabel(item.name)}</strong><p className="checks-detail">{typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail)}</p><p className="checks-detail">验证级别：{verificationLevel(item.level)}</p></div><Status value={['configuration-only', 'not-provisioned', 'declared-constraints'].includes(item.level) ? null : item.ok ? 'succeeded' : 'failed'} label={item.level === 'configuration-only' ? '仅配置确认' : item.level === 'not-provisioned' ? '尚未创建' : item.level === 'declared-constraints' ? '已声明 · 待执行验证' : undefined} /></div>)}
    </div></section>
    <div className="recent-panel"><ProjectMetadataForm project={project} live={current} onSaved={onRefresh} /></div>
    <section className="panel recent-panel"><div className="panel-head"><h2>连接信息来源</h2></div><dl className="context-list"><dt>项目来源</dt><dd>{project.sourceKind === 'repository' ? 'Git 仓库 · 源码由平台管理' : project.rootPath}</dd><dt>配置路径</dt><dd className="mono">{project.configPath}</dd></dl><div className="panel-body subtle">运行连接、构建机和镜像仓库从控制端配置读取。修改连接参数需编辑此文件后重新检查；显示信息表单仅保存名称、服务入口和已有目标选择。</div></section>
  </>;
}
