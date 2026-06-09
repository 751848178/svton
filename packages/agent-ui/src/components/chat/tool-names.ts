/** Tool name → friendly display name — single source of truth */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  subagent_spawn: 'Subagent',
  plan_create: 'Create Plan',
  plan_get_status: 'Plan Status',
  plan_update_step: 'Update Plan',
  web_fetch: 'Web Fetch',
  web_search: 'Web Search',
};

export function getToolDisplayName(name: string): string {
  return TOOL_DISPLAY_NAMES[name] || name;
}
