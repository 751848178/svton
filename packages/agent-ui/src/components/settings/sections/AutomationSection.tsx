import React, { useEffect, useMemo, useState } from 'react';
import { CompletedIcon, PendingIcon, useI18n } from '@svton/ui';
import type { ISettingsAdapter } from '../settings-adapter.types';
import type { ToolInfo } from '../settings-data.types';
import { Badge, Card } from '../settings-ui';

const HOOK_EVENTS = [
  'session_start', 'session_end', 'pre_tool_use', 'post_tool_use',
  'permission_request', 'context_compact', 'message_sent', 'message_received',
] as const;

export function AutomationSection({ hasSubagent, hasPlanning, tools, adapter }: {
  hasSubagent: boolean; hasPlanning: boolean; tools: ToolInfo[]; adapter?: ISettingsAdapter;
}) {
  const { formatDateTime, translate: t } = useI18n();
  const planTools = useMemo(() => tools.filter((tool) => tool.name.startsWith('plan_')), [tools]);
  const [hooks, setHooks] = useState<Array<{ event: string; id: string; priority: number }>>([]);
  const [checkpoints, setCheckpoints] = useState<Array<{ sessionId: string; messageCount: number; model: string; updatedAt: number }>>([]);
  useEffect(() => {
    if (adapter?.getHooks) setHooks(adapter.getHooks());
    if (adapter?.listCheckpoints) adapter.listCheckpoints().then(setCheckpoints).catch(() => {});
  }, [adapter]);
  const fallbackTools = [
    { name: 'plan_create', description: t('settings.automation.planCreate') },
    { name: 'plan_get_status', description: t('settings.automation.planStatus') },
    { name: 'plan_update_step', description: t('settings.automation.planUpdate') },
  ];
  return <div>
    <h2 className="text-lg text-white font-medium mb-1">{t('settings.automation.title')}</h2>
    <p className="text-xs text-gray-500 mb-6">{t('settings.automation.description')}</p>
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-3"><span className="text-sm text-gray-200 font-medium">{t('settings.automation.planning')}</span><Badge color={hasPlanning ? 'green' : 'gray'}>{t(hasPlanning ? 'settings.automation.enabled' : 'settings.automation.disabled')}</Badge></div>
      <div className="p-2.5 rounded-lg bg-[#171717] border border-[#383838]"><div className="space-y-1">{(planTools.length > 0 ? planTools : fallbackTools).map((tool) => <div key={tool.name} className="flex min-w-0 items-center gap-2 text-[11px]"><CompletedIcon size={12} className="shrink-0 text-green-400" aria-hidden="true" /><span className="shrink-0 font-mono text-cyan-400">{tool.name}</span><span className="truncate text-gray-500">{tool.description}</span></div>)}</div></div>
    </Card>
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-3"><span className="text-sm text-gray-200 font-medium">{t('settings.automation.subagents')}</span><Badge color={hasSubagent ? 'green' : 'gray'}>{t(hasSubagent ? 'settings.automation.enabled' : 'settings.automation.disabled')}</Badge></div>
      <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2"><div className="p-2 rounded bg-[#171717] border border-[#383838]"><span className="text-gray-500">{t('settings.automation.maxIterations')}</span><span className="ml-2 font-mono text-gray-400">20</span></div><div className="p-2 rounded bg-[#171717] border border-[#383838]"><span className="text-gray-500">{t('settings.automation.timeout')}</span><span className="ml-2 font-mono text-gray-400">120s</span></div></div>
    </Card>
    <Card className="mb-4">
      <span className="text-sm text-gray-200 font-medium block mb-3">{t('settings.hook.title')}</span>
      {hooks.length > 0 && <div className="mb-3 space-y-1"><div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{t('settings.hook.registered')}</div>{hooks.map((hook) => <div key={hook.id} className="flex items-center justify-between p-1.5 rounded bg-[#171717] border border-[#383838]"><div className="flex items-center gap-2 text-[11px]"><span className="font-mono text-cyan-400">{hook.event}</span><span className="text-gray-600">{t('settings.hook.priority', { priority: hook.priority })}</span></div><button onClick={() => { adapter?.unregisterHook?.(hook.event, hook.id); if (adapter?.getHooks) setHooks(adapter.getHooks()); }} className="min-h-11 px-2 text-[11px] text-gray-400 hover:text-red-400 focus-visible:text-red-400">{t('settings.hook.remove')}</button></div>)}</div>}
      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{t('settings.hook.supported')}</div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{HOOK_EVENTS.map((event) => { const active = hooks.some((hook) => hook.event === event); return <div key={event} className={`flex items-center gap-2 text-[11px] p-1.5 rounded border ${active ? 'bg-green-950/20 border-green-900/30' : 'bg-[#171717] border-[#383838]'}`}>{active ? <CompletedIcon size={12} className="shrink-0 text-green-400" aria-hidden="true" /> : <PendingIcon size={12} className="shrink-0 text-gray-600" aria-hidden="true" />}<span className="font-mono text-cyan-400">{event}</span><span className="text-gray-500">{t(`settings.hook.event.${event}`)}</span></div>; })}</div>
    </Card>
    <Card><span className="text-sm text-gray-200 font-medium block mb-3">{t('settings.checkpoint.title')}</span>
      {checkpoints.length === 0 ? <p className="text-xs text-gray-600 text-center py-3">{t('settings.checkpoint.empty')}</p> : <div className="space-y-1">{checkpoints.map((checkpoint) => <div key={checkpoint.sessionId} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border border-[#383838] bg-[#171717] p-2 sm:flex-nowrap"><div className="min-w-0 flex-1"><span className="text-[11px] text-gray-300 font-mono">{checkpoint.sessionId}</span><span className="ml-2 text-[10px] text-gray-600">{t(checkpoint.messageCount === 1 ? 'settings.checkpoint.messageCountOne' : 'settings.checkpoint.messageCount', { count: checkpoint.messageCount })}</span><span className="ml-2 text-[10px] text-gray-600">{checkpoint.model}</span></div><div className="flex items-center gap-2 flex-shrink-0"><span className="text-[10px] text-gray-600">{formatDateTime(checkpoint.updatedAt)}</span><button onClick={() => { adapter?.deleteCheckpoint?.(checkpoint.sessionId); if (adapter?.listCheckpoints) adapter.listCheckpoints().then(setCheckpoints); }} className="min-h-11 px-2 text-[11px] text-gray-400 hover:text-red-400 focus-visible:text-red-400">{t('settings.checkpoint.delete')}</button></div></div>)}</div>}
    </Card>
  </div>;
}
