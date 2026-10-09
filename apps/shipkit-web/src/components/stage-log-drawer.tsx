'use client';
import { useState } from 'react';
import { Select } from '@svton/ui';
import { Check, Download } from 'lucide-react';
import type { StageKey, TaskDetail } from '@/lib/contracts';
import { useStageLog } from '@/hooks/use-stage-log';
import { isBusy, stageKeys, stageLabels } from '@/lib/presentation';
import { stageState } from '@/lib/task-state';
import { ErrorMessage, Status } from './primitives';
import { FormattedLog } from './formatted-log';
import { StageLogEvidence } from './stage-log-evidence';
import { LogSidePanel } from './log-side-panel';

export function StageLogDrawer({ detail, stage, services, onClose, onStageChange }: { detail?: TaskDetail; stage: StageKey | null; services: string[]; onClose: () => void; onStageChange?: (stage: StageKey) => void }) {
  if (!stage) return null;
  // Remount only the content when changing stage/task: filter, view and cursor reset together.
  const navigation = onStageChange && <div className="log-stage-navigation"><label htmlFor="log-stage">切换阶段</label><Select id="log-stage" aria-label="切换日志阶段" value={stage} options={stageKeys.map(value => ({ value, label: stageLabels[value] }))} onChange={event => onStageChange(event.target.value as StageKey)} /></div>;
  return <LogSidePanel title={`${stageLabels[stage]} · 日志`} navigation={navigation} onClose={onClose}><StageLogContent key={`${detail?.task.id || ''}:${stage}`} detail={detail} stage={stage} services={services} /></LogSidePanel>;
}

function StageLogContent({ detail, stage, services }: { detail?: TaskDetail; stage: StageKey; services: string[] }) {
  const [service, setService] = useState('');
  const [raw, setRaw] = useState(false);
  const logs = useStageLog(detail?.task.id || '', stage, service, isBusy(detail?.task));
  const state = stage ? stageState(detail?.stages || [], stage) : null;
  const download = () => {
    const url = URL.createObjectURL(new Blob([logs.text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${detail?.task.version || detail?.task.id || 'task'}-${stage}${service ? `-${service}` : ''}.log`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  return <>
    <div className="log-toolbar"><div><label htmlFor="log-service">服务范围</label><Select id="log-service" aria-label="日志服务范围" value={service} onChange={event => setService(event.target.value)} options={[{ value: '', label: '全部相关服务' }, ...services.map(value => ({ value, label: value }))]} renderOption={option => <span className="log-service-option"><span>{option.label}</span>{option.value === service && <Check size={16} aria-hidden="true" />}</span>} /></div>{state && <Status value={state.status} label={state.label} />}</div>
    <ErrorMessage error={logs.error} />
    <p className="log-meta">{detail ? `版本 ${detail.task.version || detail.task.id}` : '尚未开始执行'} · {logs.bytes.toLocaleString('zh-CN')} 字节归档{logs.complete ? ' · 读取已完成' : isBusy(detail?.task) ? ' · 实时更新' : ''}</p>
    <div className="log-display-actions"><div role="group" aria-label="日志显示方式"><button type="button" aria-pressed={!raw} onClick={() => setRaw(false)}>{!raw && <Check size={13} aria-hidden="true" />}易读视图</button><button type="button" aria-pressed={raw} onClick={() => setRaw(true)}>{raw && <Check size={13} aria-hidden="true" />}原始文本</button></div><button type="button" className="button secondary small" disabled={!logs.text || !logs.complete} onClick={download}><Download size={14} aria-hidden="true" />下载日志</button></div>
    {!raw && logs.text && <p className="log-legend">关键字标色：<span className="log-line-step">步骤</span><span className="log-line-success">完成</span><span className="log-line-warning">警告</span><span className="log-line-error">错误</span>；保留原文</p>}
    {raw && logs.text && <p className="log-legend">控制字符以转义形式显示；下载文件保留完整原始文本。</p>}
    <div className="log-content stage-log-content">{logs.text ? <FormattedLog text={logs.text} raw={raw} /> : <p className="log-empty">{logs.loading ? '正在读取此步骤日志…' : detail ? '此步骤没有日志正文；执行状态和检查结果见下方。' : '此步骤尚未执行。手动开始发布后将在这里显示真实日志。'}</p>}</div>
    {detail && stage && <StageLogEvidence detail={detail} stage={stage} service={service} />}
  </>;
}
