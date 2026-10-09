'use client';
import type { LiveProject, Plan, Project } from '@/lib/contracts';
import { releaseCommand, serverLabel, time } from '@/lib/presentation';
import { CommandCopy } from './command-copy';
import { releaseReviewServices, releaseReviewSource } from '@/lib/release-review';
import { ImageReference } from './image-reference';
import { ConfigReference } from './config-reference';
import { ConfigDifference } from './config-difference';
import { SourceReference } from './source-reference';
import { planServiceConfig, planServiceSource } from '@/lib/release-inputs';

export function ReleasePlanView({ project, live, plan, onExecute, readOnly = false }: { project: Project; live: LiveProject; plan: Plan; onExecute: () => void; readOnly?: boolean }) {
  const release = plan.detail.releasePlan;
  const rows = releaseReviewServices(plan);
  return <>
    <div className="detail-grid"><section className="panel"><div className="panel-head"><div><h2>{readOnly ? '已保存的发布计划' : '核对本次发布计划'}</h2><p className="subtle">版本 {plan.version} · 计划基线 {plan.baseReleaseId || '首次部署'}{readOnly ? ' · 归档只读' : ` · 有效至 ${time(plan.expiresAt)}`}</p></div><button className="button primary" onClick={onExecute}>{readOnly ? '查看执行记录' : '进入执行发布'}</button></div>
      <div className="change-list">{rows.map(row => <div className="change-row" key={row.serviceKey}><strong>{row.serviceKey}</strong><div><span>{row.action}</span>{row.imageRef ? <ImageReference value={row.imageRef} /> : <span className="version" title={row.detail}>{row.detail}</span>}<ConfigReference value={planServiceConfig(plan, row.serviceKey)} />{(plan.detail.sourceSnapshot || plan.detail.currentSources || (plan.kind === 'rollback' && plan.detail.history?.restoreServices)) && <SourceReference value={planServiceSource(plan, row.serviceKey)} />}{row.selected && <ConfigDifference value={plan.detail.configDiff?.[row.serviceKey]} unavailable={plan.configMode === 'version' ? '应用所选冻结版本；当前历史配置无法逐键比较。' : '沿用或恢复该服务的配置快照。'} />}</div><span className={`tag ${row.selected ? 'good' : 'neutral'}`}>{plan.kind === 'rollback' ? '恢复' : row.selected ? '更新' : '继承'}</span></div>)}
      <div className="plan-info"><strong>外部数据保护</strong><p>数据库、外部卷与网络不会随应用镜像回滚。执行器保留部署身份与资源归属。</p>
        {release && <><p>外部卷：{release.externalResources.volumes.join('、') || '未声明'}</p><p>外部网络：{release.externalResources.networks.join('、') || '未声明'}</p><p>绑定目录：{release.externalResources.binds.join('、') || '未声明'}</p></>}
      </div>{release?.constraints.specChangedButNotSelected.length ? <p className="notice-message">未选择但配置发生变化：{release.constraints.specChangedButNotSelected.join('、')}。本轮沿用已提交版本。</p> : null}
    </div></section><aside className="panel"><div className="panel-head"><h2>{readOnly ? '归档计划信息' : plan.kind === 'config-only' ? '运行配置' : '构建与运行配置'}</h2></div><dl className="context-list">{!readOnly && <>{plan.kind === 'release' && <><dt>构建方式</dt><dd>{live.builder.mode === 'dynamic' ? '按量实例' : '现有构建机'}</dd><dt>构建规格</dt><dd>{live.builder.spec ? JSON.stringify(live.builder.spec) : '读取控制端配置'}</dd></>}<dt>运行目标显示名</dt><dd>{serverLabel(project, live)}</dd></>}<dt>运行目标</dt><dd>{plan.detail.targetKey || '原计划未记录'}</dd><dt>源码</dt><dd>{releaseReviewSource(plan)}</dd>{plan.detail.sourceSnapshot && <><dt>仓库</dt><dd className="source-url">{plan.detail.sourceSnapshot.repoUrl}</dd><dt>发布定义</dt><dd>{plan.detail.sourceSnapshot.specPath}</dd></>}<dt>源码提交</dt><dd className="mono source-commit">{plan.detail.sourceSnapshot?.commit || plan.detail.gitRef || (plan.kind === 'config-only' ? '沿用原镜像来源' : '原计划未记录')}</dd><dt>环境策略</dt><dd>{plan.kind === 'rollback' ? '恢复所选服务的历史配置快照' : plan.configMode === 'version' ? '应用冻结配置版本' : plan.configMode === 'inherit' || plan.keepEnv ? '继承当前服务配置' : '使用已有环境文件'}</dd><dt>构建机保留</dt><dd>{plan.kind !== 'release' ? '无需构建' : plan.keepBuilder ? '按配置窗口保留' : '完成后释放'}</dd></dl></aside></div>
    {!readOnly && plan.kind === 'release' && project.sourceKind !== 'repository' && plan.configMode !== 'version' && <CommandCopy command={releaseCommand({ ...project, targetKey: plan.detail.targetKey || project.targetKey }, plan.selection, plan.sourceMode, plan)} />}
  </>;
}
