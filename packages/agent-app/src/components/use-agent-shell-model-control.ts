import {
  useChat,
  type ModelKey,
  type ModelSwitchHost,
} from '@svton/agent-client';
import type { LiveModelRegistry } from '../models/model-registry';
import { useModelSwitch } from '../models/use-model-switch';

export function useAgentShellModelControl(
  registry: LiveModelRegistry,
  host: ModelSwitchHost,
  initialActive: ModelKey,
) {
  const { currentReasoningEffort: reasoningEffort } = useChat();
  const modelSelection = useModelSwitch({
    registry, host, initialActive, reasoningEffort,
  });
  return { modelSelection };
}
