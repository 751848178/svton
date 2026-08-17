import React from 'react';
import {
  ModelSelector,
  SessionSettingsControls,
  type ExecutionProfileControl,
  type ModelSelectionControl,
  type ReasoningControl,
} from '@svton/agent-ui';

interface AgentShellToolbarProps {
  modelSelection: ModelSelectionControl;
  execution: ExecutionProfileControl;
  reasoning: ReasoningControl;
  compact?: boolean;
}

export function AgentShellToolbar({
  modelSelection,
  execution,
  reasoning,
  compact = false,
}: AgentShellToolbarProps) {
  return (
    <div className={compact
      ? 'flex min-w-0 items-center justify-end gap-2 overflow-x-auto'
      : 'flex items-center justify-between border-b border-[#222] px-4 py-2'}
    >
      <ModelSelector control={modelSelection} />
      <SessionSettingsControls execution={execution} reasoning={reasoning} />
    </div>
  );
}
