import type { ServerAgentTaskPullClaimDto } from "./dto/server-execution-lease.dto";
import type { ServerAgentRuntimeSummary } from "./server-executor-supervisor.types";

export function readServerAgentRuntimeIdentityMismatch(
  dto: ServerAgentTaskPullClaimDto,
  runtime: ServerAgentRuntimeSummary | undefined,
) {
  if (!runtime || runtime.state !== "online") return undefined;

  const agentId = dto.agentId.trim();
  const runnerId = dto.runnerId?.trim();
  if (runtime.agentId && runtime.agentId !== agentId) return "agent_id";
  if (runtime.runnerId && runtime.runnerId !== runnerId) return "runner_id";
  return undefined;
}
