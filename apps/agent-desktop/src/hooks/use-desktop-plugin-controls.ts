import { useCallback, useEffect, useState } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';

export const COMPUTER_USE_TOOLS = ['screenshot', 'mouse_click', 'mouse_double_click', 'mouse_move', 'mouse_down', 'mouse_up', 'mouse_drag', 'scroll', 'keyboard_type_text', 'keyboard_press_key'];
export const CHROME_CDP_TOOLS = ['chrome_navigate', 'chrome_screenshot', 'chrome_click', 'chrome_type', 'chrome_evaluate', 'chrome_get_content'];

interface Permissions { accessibility: boolean; screen_recording: boolean }
type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

async function loadInvoke(): Promise<Invoke> {
  const api = await import('@tauri-apps/api/core' as string);
  return (api as { invoke: Invoke }).invoke;
}

export function useDesktopPluginControls(config: AgentConfig, platform: TauriPlatform) {
  const [disabledTools, setDisabledTools] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [cdpConnected, setCdpConnected] = useState<boolean | null>(null);
  const [extensionConnected, setExtensionConnected] = useState<boolean | null>(null);
  const refreshSystemState = useCallback(async () => {
    try {
      const invoke = await loadInvoke();
      setPermissions(await invoke<Permissions>('check_macos_permissions'));
      const cdp = await invoke<{ connected: boolean }>('check_chrome_cdp');
      setCdpConnected(cdp.connected);
    } catch {
      setPermissions({ accessibility: true, screen_recording: true });
    }
  }, []);
  useEffect(() => {
    void platform.storage.get<string[]>('agent:disabled_tools').then((disabled) => {
      setDisabledTools(new Set(disabled ?? []));
    });
    void refreshSystemState();
  }, [platform.storage, refreshSystemState]);
  useEffect(() => {
    const onFocus = () => { void refreshSystemState(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSystemState]);
  const persist = useCallback(async (next: Set<string>) => {
    setDisabledTools(next);
    await platform.storage.set('agent:disabled_tools', Array.from(next));
  }, [platform.storage]);
  const toggleGroup = useCallback(async (names: string[], enable: boolean) => {
    const next = new Set(disabledTools);
    if (enable) names.forEach((name) => next.delete(name));
    else names.forEach((name) => next.add(name));
    await persist(next);
    if (!enable) names.forEach((name) => config.toolRegistry?.unregister(name));
  }, [config.toolRegistry, disabledTools, persist]);
  const toggleTool = useCallback(async (name: string) => {
    const next = new Set(disabledTools);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    await persist(next);
    if (next.has(name)) config.toolRegistry?.unregister(name);
  }, [config.toolRegistry, disabledTools, persist]);
  const requestPermission = useCallback(async (type: keyof Permissions) => {
    try {
      const invoke = await loadInvoke();
      await invoke(type === 'accessibility' ? 'request_accessibility_permission' : 'request_screen_recording_permission');
      await new Promise((resolve) => setTimeout(resolve, 500));
      await invoke('open_system_settings', { pane: type });
    } catch {}
  }, []);
  const launchChrome = useCallback(async () => {
    try {
      const invoke = await loadInvoke();
      await invoke('launch_chrome_debug');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const cdp = await invoke<{ connected: boolean }>('check_chrome_cdp');
      setCdpConnected(cdp.connected);
    } catch {}
  }, []);
  const detectExtension = useCallback(async () => {
    try {
      const invoke = await loadInvoke();
      setExtensionConnected(await invoke<boolean>('check_extension_connected'));
    } catch {
      try {
        const response = await fetch('http://localhost:9223/ping', { signal: AbortSignal.timeout(2000) });
        setExtensionConnected(response.ok);
      } catch { setExtensionConnected(false); }
    }
  }, []);
  const installExtension = useCallback(async () => {
    try {
      const invoke = await loadInvoke();
      await invoke('export_chrome_extension');
      window.setTimeout(() => { void invoke('plugin:shell|open', { path: 'chrome://extensions' }); }, 1000);
    } catch (error) { console.error('Failed to export extension:', error); }
  }, []);
  return {
    disabledTools,
    permissions,
    cdpConnected,
    extensionConnected,
    toggleGroup,
    toggleTool,
    requestPermission,
    launchChrome,
    detectExtension,
    installExtension,
  };
}
