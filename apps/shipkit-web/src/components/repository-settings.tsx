'use client';
import type { Project } from '@/lib/contracts';
import { useRepositorySettings } from '@/hooks/use-repository-settings';
import { EmptyPanel, ErrorMessage, LoadingPanel } from './primitives';
import { RepositoryFields } from './repository-fields';
import { RepositoryPreview } from './repository-preview';

export function RepositorySettings({ project, onRefresh }: { project: Project; onRefresh: () => void }) {
  const control = useRepositorySettings(project, onRefresh);
  if (project.sourceKind !== 'repository') return <EmptyPanel text="此项目使用已有目录，源码来源继续由本机目录与连接配置提供。"><p className="subtle">如需独立接入 Git 仓库，请从项目列表接入新项目；现有部署身份不会自动迁移。</p></EmptyPanel>;
  if (control.query.isLoading) return <LoadingPanel text="正在读取仓库连接…" />;
  if (!control.query.data) return <><ErrorMessage error={control.query.error} /><EmptyPanel text="无法读取仓库设置。"><button className="button secondary" onClick={() => void control.query.mutate()}>重试读取</button></EmptyPanel></>;
  return <section className="panel"><div className="panel-head"><div><h2>仓库连接</h2><p className="subtle">仓库设置属于整个项目，不随运行目标切换。保存时检查来源与发布定义；已核对的计划保留固定输入。</p></div></div>
    <form className="panel-body config-form" onSubmit={event => { event.preventDefault(); void control.save(); }}><ErrorMessage error={control.error || control.query.error} />
      {control.remoteChanged && <p className="notice-message" role="status">仓库设置已被其他操作更新。当前输入已保留；保存时会检查冲突，请重新进入本页核对最新设置。</p>}
      <RepositoryFields value={control.value} onChange={control.edit} token={control.token} onToken={control.setToken} disabled={control.busy} username={control.username} onUsername={control.setUsername} hasUsername={control.query.data.hasUsername} clearUsername={control.clearUsername} onClearUsername={control.setClearUsername} hasCredential={control.query.data.hasCredential} clearCredential={control.clearCredential} onClearCredential={control.setClearCredential} />
      <button type="button" className={`button ${control.preview ? 'secondary' : 'primary'}`} onClick={() => void control.read()} disabled={control.busy}>{control.busy ? '正在检查…' : '读取并核对仓库'}</button>{control.preview && <RepositoryPreview value={control.preview} />}
      {control.saved && <p className="notice-message" role="status">仓库设置已保存，下一次发布将使用新来源设置。</p>}
      <div className="form-actions"><button className={`button ${control.preview ? 'primary' : 'secondary'}`} disabled={control.busy || !control.preview}>{control.busy ? '正在处理…' : '保存仓库设置'}</button></div>
    </form>
  </section>;
}
