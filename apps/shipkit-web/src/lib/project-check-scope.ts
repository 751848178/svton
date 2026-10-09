import type { Checks } from './contracts';

export interface ScopedChecks { scope: string; value: Checks }

export function currentProjectChecks(result: ScopedChecks | null, scope: string, targetKey: string): Checks | null {
  return result?.scope === scope && result.value.live.targetKey === targetKey ? result.value : null;
}
