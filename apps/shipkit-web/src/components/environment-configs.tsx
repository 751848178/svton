'use client';
import { useState } from 'react';
import { Select } from '@svton/ui';
import type { LiveProject, Project } from '@/lib/contracts';
import { useRuntimeConfigs } from '@/hooks/use-runtime-configs';
import { nextConfigVersion } from '@/lib/config-form';
import { time } from '@/lib/presentation';
import { EmptyPanel, LoadingPanel } from './primitives';
import { ConfigDraftEditor } from './config-draft-editor';
import { ConfigVersionDetail } from './config-version-detail';
import { ConfigStoreError } from './config-store-error';

function ConfigWorkspace({ project, targetKey }: { project: Project; targetKey: string }) {
  const control = useRuntimeConfigs(project, targetKey);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const error = control.error || control.drafts.error || control.versions.error;
  const busy = control.action !== null;
  const drafts = control.drafts.data?.items.filter(draft => draft.status === 'draft') || [];
  if (control.draft) return <ConfigDraftEditor key={`${control.draft.id}:${control.draft.etag}`} draft={control.draft} nextVersion={nextConfigVersion(control.versions.data?.items || [])} onClose={control.close} onSaved={control.saved} onFrozen={value => { setMessage(`已冻结 ${value.name} · ${value.version}，可在发布时选择。`); control.frozen(); }} />;
  return <><ConfigStoreError error={error} />{message && <p className="notice-message" role="status">{message}</p>}
    <div className="config-create-toolbar"><label htmlFor="new-config-name">新配置名称<input id="new-config-name" value={name} onChange={event => setName(event.target.value)} placeholder="例如：生产基础配置" disabled={busy} /></label><button className="button primary" disabled={busy || !name.trim()} onClick={() => void control.create(name)}>{control.action === 'create' ? '正在创建…' : '新建草稿'}</button></div>
    <p className="subtle config-scope-copy">配置保存与冻结不会修改运行服务。发布时绑定版本；未选服务沿用各自当前配置。</p>
    {control.drafts.isLoading || control.versions.isLoading ? <LoadingPanel text="正在读取此环境的配置草稿与版本…" /> : <>
      {control.drafts.error || control.versions.error ? <button className="button secondary" onClick={control.refresh}>重试读取配置</button> : null}
      {drafts.length ? <section className="panel config-collection"><div className="panel-head"><h2>配置草稿</h2></div><div className="table-wrap"><table className="config-record-table"><thead><tr><th>名称</th><th>服务</th><th>最近保存</th><th>操作</th></tr></thead><tbody>{drafts.map(draft => <tr key={draft.id}><td>{draft.name}</td><td data-label="服务">{draft.services.map(service => service.serviceKey).join('、')}</td><td data-label="最近保存">{time(draft.updatedAt)}</td><td><button className="button secondary small" onClick={() => void control.open(draft.id)} disabled={busy}>编辑草稿</button></td></tr>)}</tbody></table></div></section> : null}
      {control.detail && <ConfigVersionDetail value={control.detail} onClose={() => control.setDetail(null)} />}
      <section className="panel config-collection"><div className="panel-head"><h2>冻结配置版本</h2><span className="subtle">{control.versions.data ? `${control.versions.data.items.length} 个版本` : '未读取版本'}</span></div>{!control.versions.data ? <p className="state-message">配置版本未能读取，请重试或联系平台管理员。</p> : !control.versions.data.items.length ? <div className="state-message"><p>此环境还没有冻结配置版本。</p><p className="subtle">创建草稿，填写各服务变量或明确无需变量，再冻结为版本。</p></div> : <div className="table-wrap"><table className="config-record-table"><thead><tr><th>配置版本</th><th>覆盖服务</th><th>冻结时间</th><th>操作</th></tr></thead><tbody>{control.versions.data.items.map(version => <tr key={version.id}><td><button className="task-link" onClick={() => void control.inspect(version.id)} disabled={busy}>{version.name} · {version.version}</button>{version.archivedAt && <p className="subtle">已归档；不能用于新发布</p>}</td><td data-label="覆盖服务">{version.services.map(service => service.serviceKey).join('、')}</td><td data-label="冻结时间">{time(version.createdAt)}</td><td><button className="button ghost small" onClick={() => void control.inspect(version.id)} disabled={busy}>查看</button><button className="button secondary small" onClick={() => void control.create(version.name, version.id)} disabled={busy || !!version.archivedAt}>基于版本编辑</button><button className="button ghost small" onClick={() => void control.archive(version.id)} disabled={busy || !!version.archivedAt}>归档</button></td></tr>)}</tbody></table></div>}</section>
    </>}
  </>;
}
export function EnvironmentConfigs({ project, live }: { project: Project; live: LiveProject }) {
  const [targetKey, setTargetKey] = useState(project.targetKey || live.targetKey);
  const targets = live.targets.length ? live.targets : project.targets || [];
  if (!targets.length) return <EmptyPanel text="没有可用运行目标，请先检查此项目的连接配置。" />;
  return <><div className="settings-module-head"><div><h2>环境变量</h2><p className="subtle">按项目与现有部署目标隔离；仅用于容器运行。</p></div><div className="select-field"><label htmlFor="config-target">配置环境</label><Select id="config-target" value={targetKey} onChange={event => setTargetKey(event.target.value)} options={targets.map(target => ({ value: target.targetKey, label: project.targets?.find(item => item.targetKey === target.targetKey)?.displayName ? `${target.targetKey} · ${project.targets.find(item => item.targetKey === target.targetKey)!.displayName}` : target.targetKey }))} /></div></div><ConfigWorkspace key={`${project.id}:${targetKey}`} project={project} targetKey={targetKey} /></>;
}
