/**
 * One-call SDK composition entrypoint.
 *
 * Runtime-config preparation lives in a dedicated service; this file only
 * creates the runtime, wires its runtime-dependent subagent manager, and
 * returns the public Agent wrapper.
 */
import { AgentRuntime, SubagentManager } from '@svton/agent-core';
import type { CreateAgentConfig } from './types';
import { Agent } from './agent';
import { prepareAgentRuntimeConfig } from './create-agent-runtime-config.service';

export async function createAgent(config: CreateAgentConfig): Promise<Agent> {
  const prepared = await prepareAgentRuntimeConfig(config);
  const runtime = await AgentRuntime.createAsync(
    prepared.agentConfig,
    prepared.platform,
  );
  const subagentManager = new SubagentManager(
    prepared.agentConfig,
    runtime,
    prepared.platform,
    prepared.toolRegistry,
  );
  runtime.setSubagentManager(subagentManager);
  return new Agent(
    runtime,
    prepared.toolRegistry,
    prepared.platform,
    prepared.mcpClients,
    prepared.agentConfig.capabilities,
  );
}
