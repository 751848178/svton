export type AgentHeartbeatConfig = {
  apiUrl: string;
  token: string;
  teamId: string;
  serverId: string;
  agentId: string;
  runnerId?: string;
  capabilities: string[];
  status?: string;
  hostname?: string;
  version?: string;
  ttlSeconds?: number;
};

export type AgentHeartbeatResponse = {
  accepted?: boolean;
  agent?: unknown;
  server?: unknown;
};

export type AgentHeartbeatClient = {
  heartbeat(input: AgentHeartbeatConfig): Promise<AgentHeartbeatResponse>;
};
