import type { HookEvent, HookContext, HookResult, HookHandler, HookConfig } from './types';
import { cloneHookContext, cloneHookUpdates } from './hook-context-snapshot.utils';

/**
 * Manages lifecycle hooks.
 * Hooks can intercept, modify, or deny operations at key points.
 */
export class HookManager {
  private hooks = new Map<string, HookConfig[]>();
  private nextId = 0;

  /**
   * Register a hook.
   * Returns a hook ID that can be used to unregister.
   */
  register(config: HookConfig): string {
    const id = config.id || `hook_${this.nextId++}`;
    const entry: HookConfig = { ...config, id };

    const list = this.hooks.get(config.event) || [];
    list.push(entry);
    // Sort by priority (lower = earlier)
    list.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    this.hooks.set(config.event, list);

    return id;
  }

  /**
   * Unregister a hook by its ID.
   */
  unregister(event: HookEvent, id: string): boolean {
    const list = this.hooks.get(event);
    if (!list) return false;

    const index = list.findIndex((h) => h.id === id);
    if (index === -1) return false;

    list.splice(index, 1);
    return true;
  }

  /**
   * Trigger all hooks for an event.
   * Returns the combined result.
   */
  async trigger(event: HookEvent, context: HookContext): Promise<HookResult> {
    const list = this.hooks.get(event) || [];

    for (const hook of list) {
      try {
        const result = await hook.handler(cloneHookContext({ ...context, event }));

        if (result.action === 'deny') return result;
        if (result.action === 'modify') {
          Object.assign(context, cloneHookUpdates(result.updates));
        }
        // 'continue' and 'approve' proceed to next hook
      } catch (error) {
        console.error(`Hook error (${hook.id}):`, error);
      }
    }

    return { action: 'continue' };
  }

  /**
   * Remove all hooks for an event.
   */
  clear(event?: HookEvent): void {
    if (event) {
      this.hooks.delete(event);
    } else {
      this.hooks.clear();
    }
  }

  /**
   * List all registered hooks (metadata only, no handler function).
   */
  listHooks(): Array<{ event: HookEvent; id: string; priority: number }> {
    const result: Array<{ event: HookEvent; id: string; priority: number }> = [];
    for (const [event, list] of this.hooks) {
      for (const hook of list) {
        result.push({ event: event as HookEvent, id: hook.id || '', priority: hook.priority ?? 100 });
      }
    }
    return result;
  }
}
