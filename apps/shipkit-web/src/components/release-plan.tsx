'use client';
import type { LiveProject, Plan, Project } from '@/lib/contracts';
import { releaseCommand, serverLabel, time } from '@/lib/presentation';
import { CommandCopy } from './command-copy';
import { releaseReviewServices, releaseReviewSource } from '@/lib/release-review';
import { ImageReference } from './image-reference';

export function ReleasePlanView({ project, live, plan, onExecute, readOnly = false }: { project: Project; live: LiveProject; plan: Plan; onExecute: () => void; readOnly?: boolean }) {
  const release = plan.detail.releasePlan;
  const rows = releaseReviewServices(plan);
  return <>
    <div className="detail-grid"><section className="panel"><div className="panel-head"><div><h2>{readOnly ? '已保存的发布计划' : '核对本次发布计划'}</h2><p className="subtle">版本 {plan.version} · 计划基线 {plan.baseReleaseId || '首次部署'}{readOnly ? ' · 归档只读' : ` · 有效至 ${time(plan.expiresAt)}`}</p></div><button className="button primary" onClick={onExecute}>{readOnly ? '查看执行记录' : '进入执行发布'}</button></div>
      <div className="change-list">{rows.map(row => <div className="change-row" key={row.serviceKey}><strong>{row.serviceKey}</strong><div><span>{row.action}</span>{row.imageRef ? <ImageReference value={row.imageRef} /> : <span className="version" title={row.detail}>{row.detail}</span>}</div><span className={`tag ${row.selected ? 'good' : 'neutral'}`}>{plan.kind === 'rollback' ? '恢复' : row.selected ? '更新' : '继承'}</span></div>)}
      <div className="plan-info"><strong>外部数据保护</strong><p>数据库、外部卷与网络不会随应用镜像回滚。执行器保留部署身份与资源归属。</p>
        {release && <><p>外部卷：{release.externalResources.volumes.join('、') || '未声明'}</p><p>外部网络：{release.externalResources.networks.join('、') || '未声明'}</p><p>绑定目录：{release.externalResources.binds.join('、') || '未声明'}</p></>}
      </div>{release?.constraints.specChangedButNotSelected.length ? <p className="notice-message">未选择但配置发生变化：{release.constraints.specChangedButNotSelected.join('、')}。本轮沿用已提交版本。</p> : null}
    </div></section><aside className="panel"><div className="panel-head"><h2>{readOnly ? '归档计划信息' : '构建与运行配置'}</h2></div><dl className="context-list">{!readOnly && <><dt>构建方式</dt><dd>{live.builder.mode === 'dynamic' ? '按量实例' : '现有构建机'}</dd><dt>构建规格</dt><dd>{live.builder.spec ? JSON.stringify(live.builder.spec) : '读取控制端配置'}</dd><dt>运行目标显示名</dt><dd>{serverLabel(project, live)}</dd></>}<dt>运行目标</dt><dd>{plan.detail.targetKey || '原计划未记录'}</dd><dt>源码</dt><dd>{releaseReviewSource(plan)}</dd><dt>源码提交</dt><dd className="mono">{plan.detail.gitRef || '原计划未记录'}</dd><dt>环境配置</dt><dd>{plan.keepEnv ? '保留运行端配置' : '使用服务环境配置'}</dd><dt>构建机保留</dt><dd>{plan.kind === 'rollback' ? '无需构建' : plan.keepBuilder ? '按配置窗口保留' : '完成后释放'}</dd></dl></aside></div>
    {!readOnly && <CommandCopy command={releaseCommand({ ...project, targetKey: plan.detail.targetKey || project.targetKey }, plan.selection, plan.sourceMode, plan)} />}
  </>;
}
