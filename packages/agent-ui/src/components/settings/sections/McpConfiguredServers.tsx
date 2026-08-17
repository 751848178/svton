import React from 'react';
import { CompletedIcon, PendingIcon, cn, useI18n } from '@svton/ui';
import type { McpSectionProps } from './mcp-section.types';
import type { useMcpSection } from './use-mcp-section';
import { Card, FieldLabel, INPUT_CLS, SELECT_CLS, Toggle } from '../settings-ui';

type Model = ReturnType<typeof useMcpSection>;

export function McpConfiguredServers({ props, model }: { props: McpSectionProps; model: Model }) {
  const { translate: t } = useI18n();
  return (
    <div>
      <div className="mb-3 flex justify-end">
        {props.onAdd && !model.showAdd && <button onClick={() => model.setShowAdd(true)} className="min-h-11 rounded-lg border border-[#333] px-3 text-[11px] font-medium text-gray-400 hover:border-gray-500 hover:text-white">{t('settings.mcp.addServer')}</button>}
      </div>
      {props.configs.length > 0 ? (
        <Card className="mb-4 divide-y divide-[#2a2a2a] !p-0">
          {props.configs.map((config) => {
            const connected = config.enabled && model.connectedNames.has(config.name);
            return (
              <div key={config.name}>
                <div className="group flex min-w-0 items-center gap-3 px-4 py-2">
                  {connected ? <CompletedIcon size={14} className="shrink-0 text-green-400" aria-label={t('settings.mcp.connected')} /> : <PendingIcon size={14} className="shrink-0 text-yellow-500" aria-label={t(config.enabled ? 'settings.mcp.connecting' : 'settings.mcp.disabled')} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-gray-200">{config.name}</p>
                    <p className="truncate text-[11px] text-gray-500">{config.transport === 'stdio' ? `stdio: ${config.command} ${(config.args || []).join(' ')}` : `http: ${config.url}`}</p>
                  </div>
                  {model.connectedNames.has(config.name) && <button onClick={() => model.toggleExpand(config.name)} className="min-h-11 px-2 text-[11px] text-gray-500 hover:text-cyan-400">{t(model.expandedServer === config.name ? 'settings.mcp.collapseTools' : 'settings.mcp.expandTools')}</button>}
                  {props.onToggle && <Toggle checked={config.enabled} onChange={(enabled) => { void props.onToggle?.(config.name, enabled); props.onReload(); }} label={t('settings.mcp.serverLabel', { name: config.name })} />}
                  {props.onRemove && <button onClick={async () => { await props.onRemove?.(config.name); props.onReload(); }} className="min-h-11 px-2 text-[11px] text-gray-500 hover:text-red-400 focus-visible:text-red-400">{t('settings.mcp.remove')}</button>}
                </div>
                {model.expandedServer === config.name && model.connectedNames.has(config.name) && (
                  <div className="border-t border-[#383838] bg-[#252525]/50 px-4 pb-3">
                    <label className="my-2 flex min-h-11 items-center gap-3 text-[11px] text-gray-500">
                      <span>{t('settings.mcp.approvalMode')}</span>
                      <select value={config.approvalMode ?? 'ask'} onChange={(event) => model.setApprovalMode(config.name, event.target.value as 'auto' | 'ask' | 'deny')} className={cn(SELECT_CLS, 'max-w-48 text-[11px]')}>
                        <option value="auto">{t('settings.mcp.approval.auto')}</option><option value="ask">{t('settings.mcp.approval.ask')}</option><option value="deny">{t('settings.mcp.approval.deny')}</option>
                      </select>
                    </label>
                    {(model.serverTools[config.name]?.length ?? 0) > 0 ? model.serverTools[config.name]?.map((tool) => {
                      const enabled = !config.disabledTools?.includes(tool);
                      return <div key={tool} className="flex min-h-11 items-center gap-2"><Toggle checked={enabled} onChange={(next) => model.toggleTool(config.name, tool, next)} label={`${config.name} ${tool}`} /><span className={enabled ? 'font-mono text-[12px] text-gray-300' : 'font-mono text-[12px] text-gray-600 line-through'}>{tool}</span></div>;
                    }) : <p className="py-2 text-[11px] text-gray-600">{t('settings.mcp.loadingTools')}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ) : !model.showAdd && <Card><p className="py-6 text-center text-sm text-gray-600">{t('settings.mcp.empty')}</p></Card>}
      {model.showAdd && <McpAddServerForm props={props} model={model} />}
    </div>
  );
}

function McpAddServerForm({ props, model }: { props: McpSectionProps; model: Model }) {
  const { translate: t } = useI18n();
  const update = (field: keyof Model['form'], value: string) => model.setForm({ ...model.form, [field]: value });
  const valid = model.form.name.trim() && (model.form.transport === 'stdio' ? model.form.command.trim() : model.form.url.trim());
  return (
    <Card className="!border-cyan-900/50">
      <h3 className="mb-3 text-sm font-medium text-cyan-400">{t('settings.mcp.addTitle')}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><FieldLabel htmlFor="mcp-server-name">{t('settings.mcp.name')}</FieldLabel><input id="mcp-server-name" value={model.form.name} onChange={(event) => update('name', event.target.value)} placeholder="my-server" className={INPUT_CLS} /></div>
          {props.supportsStdio ? <div><FieldLabel htmlFor="mcp-transport">{t('settings.mcp.transport')}</FieldLabel><select id="mcp-transport" value={model.form.transport} onChange={(event) => update('transport', event.target.value)} className={SELECT_CLS}><option value="stdio">Stdio</option><option value="http">HTTP</option></select></div> : <p className="flex min-h-11 items-center rounded-lg border border-[#333] bg-[#222] px-3 text-sm text-gray-500">{t('settings.mcp.httpOnly')}</p>}
        </div>
        {model.form.transport === 'stdio' ? <><div><FieldLabel htmlFor="mcp-command">{t('settings.mcp.command')}</FieldLabel><input id="mcp-command" value={model.form.command} onChange={(event) => update('command', event.target.value)} className={INPUT_CLS} /></div><div><FieldLabel htmlFor="mcp-args">{t('settings.mcp.arguments')}</FieldLabel><input id="mcp-args" value={model.form.args} onChange={(event) => update('args', event.target.value)} className={INPUT_CLS} /></div></> : <div><FieldLabel htmlFor="mcp-url">URL</FieldLabel><input id="mcp-url" value={model.form.url} onChange={(event) => update('url', event.target.value)} className={INPUT_CLS} /></div>}
        <div className="flex gap-2"><button onClick={model.addServer} disabled={!valid} className="min-h-11 rounded-lg bg-cyan-600 px-3 text-[11px] font-medium text-white disabled:opacity-50">{t('action.add')}</button><button onClick={() => model.setShowAdd(false)} className="min-h-11 px-3 text-[11px] text-gray-500">{t('action.cancel')}</button></div>
      </div>
    </Card>
  );
}
