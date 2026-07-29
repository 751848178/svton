import type { ToolResult } from '../tool/types';
import type { SvtonCapabilityEvent } from './types';

/** Drain one policy execution while routing its capability-only events. */
export async function settleToolExecution(
  execution: AsyncGenerator<SvtonCapabilityEvent, ToolResult>,
  onCapability?: (event: SvtonCapabilityEvent) => void,
): Promise<ToolResult> {
  while (true) {
    const step = await execution.next();
    if (step.done) return step.value;
    onCapability?.(step.value);
  }
}
