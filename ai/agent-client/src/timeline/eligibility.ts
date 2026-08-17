const EXCLUDED_TIMELINE_TOOLS = new Set(['request_user_input']);

/** Tools with their own decision surface must not also enter the execution timeline. */
export function isTimelineEligibleTool(name: string): boolean {
  return !EXCLUDED_TIMELINE_TOOLS.has(name);
}
