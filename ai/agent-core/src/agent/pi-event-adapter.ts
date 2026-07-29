/**
 * Pi AgentEvent → svton AgentEvent bridge.
 *
 * Pi Agent emits 10 lifecycle event types via `agent.subscribe()`. Svton
 * consumers (chat.service, SDK, subagent) expect the 12-variant svton
 * `AgentEvent` union. This module owns the in-memory event queue and the
 * translation logic, keeping the runtime file small.
 *
 * Mapping table (Pi → svton):
 *   message_update {text_delta}        → text_delta
 *   message_update {thinking_delta}    → thinking_delta
 *   message_update {toolcall_start}    → tool_call_start (empty args)
 *   message_update {toolcall_end}      → tool_call_progress (parsed args)
 *   tool_execution_start               → (consumed internally; tool adapter
 *                                        emits tool_call_progress/end via sink)
 *   tool_execution_update              → tool_call_progress (streamed partial)
 *   tool_execution_end                 → (the tool adapter emits tool_call_end)
 *   message_end {error/aborted}        → error + done (terminal)
 *   message_end {done/toolUse/stop}    → accumulate usage for terminal done
 *   agent_end                          → done (if not already terminal)
 *
 * The terminal `done` event is emitted by the runtime (not here) so it can
 * fold in stopReason + accumulated usage + max-iteration policy.
 */
import type { AgentEvent as PiAgentEvent } from '@earendil-works/pi-agent-core';
import type { AssistantMessageEvent, AssistantMessage, Usage } from '@earendil-works/pi-ai';
import type { AgentEvent } from './types';
import { readToolCallFromEvent, extractPartialText } from './pi-event-helpers';
export { piUsageToTokenUsage } from './pi-usage.utils';

/** Queue of svton events waiting for the runtime generator to drain. */
export class PiEventAdapter {
  private queue: AgentEvent[] = [];
  private resolveWaiter: (() => void) | null = null;
  private closed = false;
  /** Most recent assistant usage observed (for the terminal done event). */
  private lastUsage: Usage | null = null;
  /** Final assistant message of the run, if any. */
  private lastAssistant: AssistantMessage | null = null;
  /** Tracks whether the LLM stream produced an error/abort this run. */
  private terminalStopReason: string | null = null;
  /** Tracks whether the run has already reached its natural end. */
  private runEnded = false;

  /** Push a translated svton event; wakes the draining generator. */
  push(event: AgentEvent): void {
    if (this.closed) return;
    this.queue.push(event);
    this.wake();
  }

  /** Wake any waiting drain loop. */
  private wake(): void {
    const w = this.resolveWaiter;
    this.resolveWaiter = null;
    w?.();
  }

  /**
   * Pull the next queued svton event, awaiting until one arrives or the run
   * finalizes. Returns `null` when the run has ended and the queue is empty.
   */
  async next(): Promise<AgentEvent | null> {
    while (true) {
      if (this.queue.length > 0) return this.queue.shift()!;
      if (this.closed && this.queue.length === 0) return null;
      await new Promise<void>((resolve) => {
        this.resolveWaiter = resolve;
      });
    }
  }

  /** Mark the adapter closed; pending waiters resolve to null. */
  close(): void {
    this.closed = true;
    this.wake();
  }

  /** Reset per-run state for a new prompt. */
  resetRun(): void {
    this.lastUsage = null;
    this.lastAssistant = null;
    this.terminalStopReason = null;
    this.runEnded = false;
  }

  /** True once the Pi loop has emitted its terminal message/agent_end. */
  get runFinished(): boolean {
    return this.runEnded;
  }

  /** The terminal stop reason derived from the final assistant message. */
  getStopReason(): string {
    return this.terminalStopReason ?? 'stop';
  }

  /** The accumulated usage for the terminal done event. */
  getUsage(): Usage | null {
    return this.lastUsage;
  }

  /**
   * Translate a single Pi AgentEvent into svton events on the queue.
   * Returns when all derived svton events have been pushed.
   */
  async handle(event: PiAgentEvent): Promise<void> {
    switch (event.type) {
      case 'message_update':
        this.handleAssistantEvent(event.assistantMessageEvent);
        break;
      case 'message_end': {
        const msg = event.message as AssistantMessage | undefined;
        if (msg) {
          this.lastAssistant = msg;
          if (msg.usage) this.lastUsage = msg.usage;
          if (msg.stopReason === 'error' || msg.stopReason === 'aborted') {
            this.terminalStopReason = msg.stopReason;
            if (msg.stopReason === 'error' && msg.errorMessage) {
              this.push({ type: 'error', error: new Error(msg.errorMessage) });
            }
          }
        }
        break;
      }
      case 'agent_end':
        this.runEnded = true;
        break;
      case 'tool_execution_update': {
        // A tool streamed partial output via Pi's onUpdate (bridged from the
        // svton ToolContext.onProgress in pi-tool-adapter). Surface it as a
        // svton tool_call_progress so consumers can render live tool output.
        const text = extractPartialText(event.partialResult);
        this.push({
          type: 'tool_call_progress',
          callId: event.toolCallId,
          name: event.toolName,
          message: text,
        });
        break;
      }
      // turn_start/turn_end/message_start/tool_execution_* are either
      // bookkeeping or owned by the tool-adapter sink; no direct mapping here.
      default:
        break;
    }
  }

  /** Translate a raw pi-ai AssistantMessageEvent (delta) into svton events. */
  private handleAssistantEvent(ev: AssistantMessageEvent): void {
    switch (ev.type) {
      case 'text_delta':
        this.push({ type: 'text_delta', text: ev.delta });
        break;
      case 'thinking_delta':
        this.push({ type: 'thinking_delta', thinking: ev.delta });
        break;
      case 'toolcall_start': {
        const call = readToolCallFromEvent(ev);
        if (call) {
          this.push({ type: 'tool_call_start', call: { ...call, arguments: {} } });
        }
        break;
      }
      case 'toolcall_end': {
        const call = readToolCallFromEvent(ev);
        if (call) {
          // Mirror the legacy runtime: emit a progress event with the parsed
          // arguments once the call is fully received.
          this.push({
            type: 'tool_call_progress',
            callId: call.id,
            name: call.name,
            message: '',
            arguments: call.arguments,
          });
        }
        break;
      }
      // start/text_start/text_end/thinking_start/thinking_end/done/error are
      // bookkeeping; svton accumulates text/thinking from deltas.
      default:
        break;
    }
  }
}
