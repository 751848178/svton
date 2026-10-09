'use client';
import { Server } from 'lucide-react';
import type { LiveProject, Task } from '@/lib/contracts';
import { isBusy, requiresCleanup, statusLabel } from '@/lib/presentation';
import { Status } from './primitives';

export function BuilderStatePanel({ task, live, busy, onCleanup }: { task?: Task; live: LiveProject; busy?: boolean; onCleanup: () => void }) {
  const failed = requiresCleanup(task);
  const cleanupLabel = task && isBusy(task) && task.cleanupState === 'pending' ? live.builder.mode === 'dynamic' ? '流程进行中，日志归档后清理' : '流程进行中，构建机保留运行' : undefined;
  return <aside className="panel builder-panel"><div className="panel-head"><h2>构建机状态</h2></div><div className="panel-body builder-state"><Server size={24} aria-hidden="true" /><span><strong>{live.builder.mode === 'dynamic' ? '动态构建资源' : '现有构建机'}</strong><span className="subtle">{cleanupLabel || (task ? statusLabel(task.cleanupState) : live.builder.mode === 'dynamic' ? '发布时按需创建' : '绑定的构建机保留运行')}</span></span></div>
    <div className="panel-body"><Status value={task?.cleanupState} label={!task ? '尚未执行' : cleanupLabel} /><p className="subtle">应用发布结果与构建机释放结果分别记录。日志在释放前归档。</p>
      {failed && <button className="button secondary" onClick={onCleanup} disabled={busy || isBusy(task)}>重试释放</button>}
      {task && ['retained', 'kept'].includes(task.cleanupState) && <button className="button secondary" onClick={onCleanup} disabled={busy || isBusy(task)}>释放保留构建机</button>}
    </div>
  </aside>;
}
