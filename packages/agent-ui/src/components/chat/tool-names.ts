import { t } from '@svton/ui';

/** Legacy static names for tools not yet migrated to i18n */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  subagent_spawn: 'Subagent',
  plan_create: 'Create Plan',
  plan_get_status: 'Plan Status',
  plan_update_step: 'Update Plan',
  web_fetch: 'Web Fetch',
  web_search: 'Web Search',
};

/** i18n keys for Computer Use + Chrome CDP tools */
const I18N_TOOL_KEYS: Record<string, string> = {
  screenshot: 'tool.screenshot',
  mouse_click: 'tool.mouse_click',
  mouse_double_click: 'tool.mouse_double_click',
  mouse_move: 'tool.mouse_move',
  mouse_down: 'tool.mouse_down',
  mouse_up: 'tool.mouse_up',
  mouse_drag: 'tool.mouse_drag',
  scroll: 'tool.scroll',
  keyboard_type: 'tool.keyboard_type',
  keyboard_press_key: 'tool.keyboard_press_key',
  chrome_navigate: 'tool.chrome_navigate',
  chrome_screenshot: 'tool.chrome_screenshot',
  chrome_click: 'tool.chrome_click',
  chrome_type: 'tool.chrome_type',
  chrome_evaluate: 'tool.chrome_evaluate',
  chrome_get_content: 'tool.chrome_get_content',
};

export function getToolDisplayName(name: string): string {
  // MCP tools use the Codex-standard mcp__<server>__<tool> namespace.
  // Display as "<server>/<tool>" so the source is visible at a glance.
  if (name.startsWith('mcp__')) {
    const parts = name.split('__');     // ['mcp', 'server', 'tool']
    if (parts.length >= 3) {
      const server = parts[1];
      const tool = parts.slice(2).join('__');
      return `${server}/${tool}`;
    }
  }
  const i18nKey = I18N_TOOL_KEYS[name];
  if (i18nKey) return t(i18nKey);
  return TOOL_DISPLAY_NAMES[name] || name;
}

/** Extract the MCP server name from a namespaced tool name (mcp__server__tool). */
export function getMcpServerName(name: string): string | null {
  if (!name.startsWith('mcp__')) return null;
  const parts = name.split('__');
  return parts.length >= 3 ? parts[1] : null;
}
