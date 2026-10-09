'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@svton/ui';
import type { HistoryItem, HistoryView, Plan, Project, Task } from '@/lib/contracts';
import { request } from '@/lib/api';
import { time } from '@/lib/presentation';
import { ErrorMessage } from './primitives';
import { ImageReference } from './image-reference';

export function RollbackModal({ item, history, project, onClose, onTask }: { item: HistoryItem | null; history: HistoryView; project: Project; onClose: () => void; onTask: (task: Task) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { setSelected(item?.changedServices || []); setPlan(null); setError(null); }, [item?.releaseId]);
  const parent = history.items.find(record => record.releaseId === (item?.targetSnapshotId || item?.parentReleaseId));
  const restore = item?.restoreServices || parent?.services;
  const submit = async () => {
    if (!item) return;
    setBusy(true); setError(null);
    try {
      if (!plan) setPlan(await request('POST:/projects/:id/plans', { id: project.id, kind: 'rollback', services: selected, changeReleaseId: item.releaseId }));
      else { const task = await request('POST:/projects/:id/tasks', { id: project.id, planId: plan.id, idempotencyKey: crypto.randomUUID() }); onTask(task); onClose(); }
    } catch (failure) { setError(failure); } finally { setBusy(false); }
  };
  return <Modal open={item !== null} onClose={busy ? () => {} : onClose} title={plan ? '核对历史快照回滚' : '选择回滚范围'} width={580} ariaCloseLabel="关闭回滚计划" footer={<div className="form-actions"><button className="button secondary" onClick={onClose} disabled={busy}>取消</button><button className="button primary" onClick={submit} disabled={busy || !selected.length || !item?.rollbackAvailable}>{busy ? '正在处理…' : plan ? '确认执行回滚' : '生成回滚计划'}</button></div>}>
    <ErrorMessage error={error} />{item && <>
      <p>撤销历史变更 <strong className="mono task-id">{item.releaseId}</strong> 对所选服务的更新。</p>
      <dl className="context-grid"><dt>当前基线</dt><dd className="mono">{plan?.baseReleaseId || history.current || '无当前基线'}</dd><dt>目标快照</dt><dd className="mono">{item.targetSnapshotId || item.parentReleaseId || '无变更前快照'}</dd>{plan && <><dt>计划有效期</dt><dd>{time(plan.expiresAt)}</dd></>}</dl>
      <div className="rollback-list">{item.changedServices.map(service => <div className="rollback-option" key={service}><input id={`rollback-${service}`} type="checkbox" checked={selected.includes(service)} disabled={busy || !!plan} onChange={() => { setPlan(null); setSelected(value => value.includes(service) ? value.filter(key => key !== service) : [...value, service]); }} /><div><label htmlFor={`rollback-${service}`}><strong>{service}</strong></label><ImageReference prefix="恢复至" value={restore?.[service]?.imageRef} empty="目标镜像不可用，执行器将拒绝缺失快照" /></div></div>)}</div>
      {plan && <div className="rollback-review">后端已核对目标快照、服务覆盖与当前基线。确认后创建独立回滚任务；过期或基线变化会被拒绝。</div>}
      {!item.rollbackAvailable && <p className="form-error">{item.reason || '此历史快照不可用于回滚。'}</p>}
      <p className="subtle">其他服务继承当前版本。回滚不创建构建机，数据库与外部数据卷保持原状。</p>
    </>}
  </Modal>;
}
