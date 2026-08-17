import React from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { CompletedIcon, PendingIcon } from '@svton/ui';
import { SettingsSwitch } from '@svton/agent-ui';
import {
  CHROME_CDP_TOOLS,
  COMPUTER_USE_TOOLS,
  useDesktopPluginControls,
} from '@/hooks/use-desktop-plugin-controls';

export function DesktopPluginsPanel({ config, platform }: { config: AgentConfig; platform: TauriPlatform }) {
  const controls = useDesktopPluginControls(config, platform);
  return (
    <section aria-labelledby="desktop-plugins-heading" className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <h2 id="desktop-plugins-heading" className="mb-4 text-lg font-light text-white">插件管理</h2>
      {controls.permissions && (
        <section aria-labelledby="system-permissions-heading" className="mb-6 space-y-2">
          <h3 id="system-permissions-heading" className="mb-2 text-[13px] font-medium text-gray-400">系统权限</h3>
          {([
            { key: 'accessibility' as const, label: '辅助功能', description: '鼠标和键盘控制需要此权限' },
            { key: 'screen_recording' as const, label: '屏幕录制', description: '截图功能需要此权限' },
          ]).map((permission) => {
            const granted = controls.permissions?.[permission.key] ?? false;
            return (
              <div key={permission.key} className="flex items-center justify-between gap-3 rounded-lg border border-[#383838] bg-[#2a2a2a] px-4 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  {granted ? <CompletedIcon size={14} className="text-green-500" aria-hidden="true" /> : <PendingIcon size={14} className="text-yellow-500" aria-hidden="true" />}
                  <div><p className="text-sm text-white">{permission.label}</p><p className="text-[11px] text-gray-500">{permission.description}</p></div>
                </div>
                {granted ? <span className="text-[11px] text-green-500">已授权</span> : (
                  <button onClick={() => controls.requestPermission(permission.key)} className="min-h-11 rounded-md bg-[#3B82F6] px-3 text-[11px] text-white hover:bg-[#60A5FA]">请求权限</button>
                )}
              </div>
            );
          })}
        </section>
      )}
      <ChromeConnection controls={controls} />
      <ToolGroup title="Computer Use" names={COMPUTER_USE_TOOLS} controls={controls} />
      <ToolGroup title="Chrome CDP" names={CHROME_CDP_TOOLS} controls={controls} />
      <p className="text-[11px] text-gray-600">禁用工具在下次新会话时完全生效。</p>
    </section>
  );
}

type Controls = ReturnType<typeof useDesktopPluginControls>;

function ChromeConnection({ controls }: { controls: Controls }) {
  return (
    <section aria-labelledby="chrome-connection-heading" className="mb-6 space-y-2">
      <h3 id="chrome-connection-heading" className="text-[13px] font-medium text-gray-400">Chrome 连接</h3>
      <ConnectionRow label="Chrome 扩展" connected={controls.extensionConnected} description={controls.extensionConnected ? '扩展已连接' : '扩展未连接'}>
        {!controls.extensionConnected && <><button onClick={controls.detectExtension} className="min-h-11 px-2 text-[11px] text-gray-300">检测</button><button onClick={controls.installExtension} className="min-h-11 px-2 text-[11px] text-blue-400">安装扩展</button></>}
      </ConnectionRow>
      <ConnectionRow label="启动参数" connected={controls.cdpConnected} description={controls.cdpConnected ? 'Chrome 已连接（端口 9222）' : '未启动调试端口'}>
        {!controls.cdpConnected && <button onClick={controls.launchChrome} className="min-h-11 px-2 text-[11px] text-gray-300">启动 Chrome</button>}
      </ConnectionRow>
    </section>
  );
}

function ConnectionRow({ label, connected, description, children }: { label: string; connected: boolean | null; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#383838] bg-[#2a2a2a] px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        {connected ? <CompletedIcon size={14} className="text-green-500" aria-hidden="true" /> : <PendingIcon size={14} className="text-gray-500" aria-hidden="true" />}
        <div><p className="text-sm text-white">{label}</p><p className="text-[11px] text-gray-500">{description}</p></div>
      </div>
      <div className="flex shrink-0 items-center gap-1">{connected ? <span className="text-[11px] text-green-500">已连接</span> : children}</div>
    </div>
  );
}

function ToolGroup({ title, names, controls }: { title: string; names: string[]; controls: Controls }) {
  const enabled = names.some((name) => !controls.disabledTools.has(name));
  return (
    <section aria-label={title} className="mb-6">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-medium text-gray-400">{title}</h3><SettingsSwitch checked={enabled} onCheckedChange={(next) => controls.toggleGroup(names, next)} label={title} /></div>
      <div className="divide-y divide-[#252525] rounded-lg border border-[#383838] bg-[#2a2a2a]">
        {names.map((name) => <div key={name} className="flex min-h-11 items-center justify-between px-4"><span className="text-[13px] text-gray-300">{name}</span><SettingsSwitch checked={!controls.disabledTools.has(name)} onCheckedChange={() => controls.toggleTool(name)} label={`切换 ${name}`} /></div>)}
      </div>
    </section>
  );
}
