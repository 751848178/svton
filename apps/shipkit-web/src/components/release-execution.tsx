'use client';
import { useState } from 'react';
import { Box, Check, ChevronRight, Play, Server, TriangleAlert } from 'lucide-react';
import { Modal } from '@svton/ui';
import type { LiveProject, StageKey, TaskDetail } from '@/lib/contracts';
import type { ReleaseController } from '@/hooks/use-release';
import { isBusy, phaseLabel, stageDescriptions, stageKeys, stageLabels, statusLabel } from '@/lib/presentation';
import { cancellationBlocked, stageState, taskSummary } from '@/lib/task-state';
import { BuilderStatePanel } from './builder-state-panel';
import { StageLogDrawer } from './stage-log-drawer';

export function ReleaseExecution({ control, live, detail, onNew }: { control: ReleaseController; live: LiveProject; detail?: TaskDetail; onNew: () => void }) {
  const [stage, setStage] = useState<StageKey | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const task = detail?.task;
  const running = isBusy(task);
  const summary = task && !running ? taskSummary(task) : null;
  const completed = stageKeys.filter(key => ['succeeded', 'skipped'].includes(stageState(detail?.stages || [], key).status)).length;
  const canCancel = running && task?.status !== 'cancel-requested' && !cancellationBlocked(task);
  return <><div className="detail-grid"><section className="panel execution-panel"><div className="panel-head"><div><h2>{task?.kind === 'rollback' ? '执行历史快照回滚' : '执行发布'}</h2><p className="subtle execution-current">{running ? `${task?.status === 'interrupted' ? '远端状态待核对' : statusLabel(task?.status)} · ${task?.phase ? phaseLabel(task.phase) : '准备执行'}` : task ? '本轮执行已结束；可查看日志或再次发布' : '等待手动开始，尚未执行'} · {control.selected.join('、')}</p></div>
      <div className="execution-actions"><span className="tag execution-count">{completed} / 6</span>{running && <button className="button secondary" onClick={() => setConfirmCancel(true)} disabled={!canCancel || control.action !== null}>{task?.status === 'cancel-requested' ? '取消请求中' : cancellationBlocked(task) ? '提交阶段不可取消' : '请求取消并恢复'}</button>}
        <button className="button primary" onClick={task ? onNew : control.start} disabled={control.busy || control.cleanupBlocked}><Play size={16} aria-hidden="true" />{control.action === 'start' ? '正在启动…' : running ? '正在执行' : task ? '开始新发布' : '开始发布'}</button>
      </div></div>
      {control.cleanupBlocked && <p className="execution-blocked" role="status">构建机待释放。先重试释放，确认后才能再次发布。</p>}
      {task?.status === 'cancel-requested' && <p className="execution-blocked" role="status">取消请求已持久保存，正在等待运行端确认。请继续查看任务，不要将请求中视为已取消。</p>}
      {summary && <div className={`execution-outcome ${summary.variant === 'success' ? '' : 'warning'}`} role="status"><strong>{summary.title}</strong><p>{summary.description} 点击上方“查看结果”核对本次状态。</p></div>}
      <ol className="timeline">{stageKeys.map(key => {
        const state = stageState(detail?.stages || [], key);
        const kind = state.status === 'succeeded' ? 'done' : state.status === 'running' ? 'active' : state.status === 'failed' ? 'failed' : state.status;
        const Icon = state.status === 'succeeded' ? Check : state.status === 'failed' ? TriangleAlert : key === 'provision' || key === 'cleanup' ? Server : Box;
        return <li key={key} className={`stage ${kind}`} data-stage-row={key}><button className="stage-button" onClick={() => setStage(key)} aria-label={`${stageLabels[key]}，${statusLabel(state.status)}，查看日志`}><span className="stage-marker"><Icon size={16} aria-hidden="true" /></span><span className="stage-content"><strong>{stageLabels[key]}</strong><span className="stage-description">{state.description || stageDescriptions[key]}</span></span><span className="stage-state subtle">{state.label || statusLabel(state.status)}</span><ChevronRight size={15} className="stage-chevron" aria-hidden="true" /></button></li>;
      })}</ol><p className="subtle execution-hint">点击任一步骤查看该阶段日志。实际生命周期在镜像推送后归档日志并清理构建资源，再部署与检查运行服务。</p>
    </section><BuilderStatePanel task={task} live={live} busy={control.action !== null} onCleanup={control.cleanup} /></div>
    <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="请求取消并恢复" description="后台将在安全点与远端协作取消。提交临界区不能取消；恢复也可能失败。" ariaCloseLabel="关闭取消确认" footer={<div className="form-actions"><button className="button secondary" onClick={() => setConfirmCancel(false)}>继续执行</button><button className="button danger" onClick={() => { setConfirmCancel(false); void control.cancel(); }}>发送取消请求</button></div>}><p className="subtle">本机页面不会通过停止轮询或终止进程来宣称取消成功。任务最终结果、旧版本恢复和临时资源清理分别记录。</p></Modal>
    <StageLogDrawer detail={detail} stage={stage} services={control.selected} onClose={() => setStage(null)} onStageChange={setStage} />
  </>;
}
