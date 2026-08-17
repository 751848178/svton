/**
 * Chat runtime lifecycle — runtime creation, subagent wiring, model-switch
 * message preservation, and the init/reinit orchestration.
 *
 * Extracted from ChatService (PI007). The model-switch path is the
 * PI004-flagged 3-list divergence fix: instead of rebuilding the runtime
 * transcript from the DISPLAY list (which drops tool_result blocks), the
 * canonical runtime truth is snapshotted via `runtime.getMessages()` before
 * the runtime is recreated and re-seeded into the new runtime — a strict
 * one-way runtime → runtime flow.
 */

import {
  SubagentManager,
  SvtonAgentRuntime,
  csvFanoutDef,
  CsvFanoutExecutor,
} from '@svton/agent-core';
import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import { SubagentSpawnExecutor, subagentSpawnDef } from '../tool/subagent-spawn';
import {
  reseedRuntimeFromSnapshot,
  snapshotRuntimeMessages,
} from './chat-runtime-bridge';
import type { MessageStoreHost } from './chat-message-store';
import { cloneRuntimeConfig } from './chat-runtime-config';

export interface ReinitBindings {
  platform: IPlatform;
  config: AgentConfig;
  hasPendingApprovals: () => boolean;
  teardownApprovals: () => void;
  /** Attach input history to the platform + observable publisher. */
  attachHistory: () => Promise<void>;
}

/**
 * Recreate the Pi-backed runtime for a model switch / first init.
 *
 * Tears down pending approvals, captures the canonical runtime truth
 * (`runtime.getMessages()`) BEFORE recreating, then re-seeds the new runtime
 * from that snapshot — one-way, runtime → runtime, so tool_result blocks
 * survive. Also wires the SubagentManager (post-creation, breaking the
 * agent ↔ subagent cycle).
 *
 * Returns the new runtime + whether a snapshot was applied (used by the caller
 * to decide whether to reset the display list).
 */
export async function recreateRuntime(
  bindings: ReinitBindings,
  previousRuntime: SvtonAgentRuntime | null,
): Promise<{ runtime: SvtonAgentRuntime; snapshotApplied: boolean }> {
  if (bindings.hasPendingApprovals()) {
    previousRuntime?.abort();
    bindings.teardownApprovals();
  }
  // PI007 3-list fix: snapshot canonical runtime truth BEFORE recreating.
  const snapshot = snapshotRuntimeMessages(previousRuntime);
  await bindings.attachHistory();

  const runtime = await createConfiguredRuntime(bindings.config, bindings.platform);

  if (snapshot) reseedRuntimeFromSnapshot(runtime, snapshot);
  return { runtime, snapshotApplied: snapshot !== null };
}

/** Create a transcript-empty runtime while a prior runtime finishes in background. */
export async function createIsolatedRuntime(
  config: AgentConfig,
  platform: IPlatform,
): Promise<SvtonAgentRuntime> {
  return createConfiguredRuntime(config, platform, []);
}

export async function createConfiguredRuntime(
  config: AgentConfig,
  platform: IPlatform,
  initialMessages = config.initialMessages,
): Promise<SvtonAgentRuntime> {
  const runtimeConfig = cloneRuntimeConfig(config, initialMessages);
  const runtime = await SvtonAgentRuntime.createAsync(runtimeConfig, platform);
  await wireSubagentManager(runtimeConfig, runtime, platform);
  if (runtimeConfig.reasoningEffort !== undefined) {
    runtime.setReasoningEffort(runtimeConfig.reasoningEffort);
  }
  return runtime;
}

/** Register the subagent_spawn + csv_fanout tools backed by a SubagentManager. */
async function wireSubagentManager(
  config: AgentConfig,
  runtime: SvtonAgentRuntime,
  platform: IPlatform,
): Promise<void> {
  if (!config.capabilities || config.capabilities.subagentManager) return;
  try {
    const mgr = new SubagentManager(config, runtime, platform, config.toolRegistry);
    runtime.setSubagentManager(mgr);
    config.capabilities.subagentManager = mgr;
    config.toolRegistry.register(subagentSpawnDef, new SubagentSpawnExecutor(mgr));
    if ((config.capabilities as { csvFanoutEnabled?: boolean }).csvFanoutEnabled !== false) {
      config.toolRegistry.register(csvFanoutDef, new CsvFanoutExecutor(mgr));
    }
  } catch {
    // Subagent/csv-fanout wiring is best-effort; the core runtime still works.
  }
}

/** Type re-export so callers can reference the host interface without a direct import cycle. */
export type { MessageStoreHost };
