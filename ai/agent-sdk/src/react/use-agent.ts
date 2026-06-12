/**
 * useAgent — access the Agent instance from context.
 */

import { useAgentContext } from './context';

export interface UseAgentReturn {
  /** The Agent instance (null during initialization) */
  agent: ReturnType<typeof useAgentContext>['agent'];
}

export function useAgent(): UseAgentReturn {
  const { agent } = useAgentContext();
  return { agent };
}
