export type ServerAgentTaskPullLockOwnerInput = {
  agentId: string;
  serverId: string;
  runnerId?: string;
};

export function buildServerAgentTaskPullLockOwner(
  input: ServerAgentTaskPullLockOwnerInput,
) {
  const runner = input.runnerId?.trim() || input.serverId;
  return `server-agent:${input.agentId.trim()}:${runner}`.slice(0, 160);
}
