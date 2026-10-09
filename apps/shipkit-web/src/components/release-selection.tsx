'use client';
import { Select } from '@svton/ui';
import type { LiveProject, Project } from '@/lib/contracts';
import type { ReleaseController } from '@/hooks/use-release';
import { ServiceTable } from './service-table';
import { ReleaseSelectionReview } from './release-selection-review';

export function ReleaseSelection({ project, live, control }: { project: Project; live: LiveProject; control: ReleaseController }) {
  if (control.readOnly) return control.plan ? <ReleaseSelectionReview plan={control.plan} /> : <section className="panel"><div className="state-message">原任务未保存发布计划，无法恢复服务范围。</div></section>;
  const first = live.runtime.currentReleaseId === null;
  return <section className="panel"><div className="panel-head"><div><h2>选择本次更新的服务</h2><p className="subtle">{first ? '首次部署需要选择所有服务。' : '未选择的服务继承当前运行版本。'}</p></div><div className="panel-head-actions"><button className="button primary" onClick={control.generatePlan} disabled={!control.selected.length || control.busy}>{control.action === 'plan' ? '正在生成计划…' : '生成发布计划'}</button></div></div>
    <ServiceTable project={project} live={live} selected={control.selected} onToggle={control.toggle} locked={first || control.busy} />
    <div className="selection-summary"><div><strong>已选择 {control.selected.length} / {live.services.length} 个服务</strong><p className="scope-line">{control.selected.join('、') || '请至少选择一个服务'}</p></div><span className="subtle">计划为只读；开始执行前不会创建构建机。</span></div>
    <div className="panel-body config-form"><label>发布版本<input value={control.version} onChange={event => control.setVersion(event.target.value)} disabled={control.busy} inputMode="decimal" placeholder="0.0.1" /><span className="form-help">默认使用本项目的下一个版本；可填写 1.0.0 等主版本.次版本.修订号，生成计划时校验唯一性。</span></label><div className="select-field"><label htmlFor="source-mode">源码来源</label><Select id="source-mode" value={control.sourceMode} onChange={event => control.setSourceMode(event.target.value as 'git' | 'directory')} options={[{ value: 'git', label: 'Git · 已提交的源码', disabled: !control.gitAvailable }, { value: 'directory', label: '本机目录 · 包含当前工作区' }]} disabled={control.busy} /></div>
      {!control.gitAvailable && <p className="subtle">未检测到可用的 Git 仓库来源或已提交版本，使用本机目录快照。配置仓库来源并提交代码后可选择 Git。</p>}
      <p className="subtle">分支 {live.source.branch || '不可用'} · 提交 <span className="mono">{live.source.commit || '不可用'}</span>{live.source.dirty === true ? ' · 存在未提交变更' : ''}</p>
      {!first && <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}><input type="checkbox" checked={control.keepEnv} onChange={event => control.setKeepEnv(event.target.checked)} disabled={control.busy} />保留运行端已提交的环境配置</label>}
      {live.builder.mode === 'dynamic' && <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}><input type="checkbox" checked={control.keepBuilder} onChange={event => control.setKeepBuilder(event.target.checked)} disabled={control.busy} />按配置保留窗口复用构建机</label>}
    </div>
  </section>;
}
