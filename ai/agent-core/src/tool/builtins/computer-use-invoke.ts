import type { ToolContext } from '../types';

/**
 * Resolve the Computer Use backend: prefer the platform-injected
 * `computerUse.invoke` for testability and desktop integration.
 */
export async function computerInvoke<T = unknown>(
  ctx: ToolContext,
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (ctx.platform.computerUse) {
    return ctx.platform.computerUse.invoke<T>(command, args);
  }
  const api = await import('@tauri-apps/api/core' as string);
  return (api as any).invoke(command, args);
}
