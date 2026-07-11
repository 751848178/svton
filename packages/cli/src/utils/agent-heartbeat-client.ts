import type {
  AgentHeartbeatClient,
  AgentHeartbeatConfig,
  AgentHeartbeatResponse,
} from "./agent-heartbeat-types";

type FetchLike = typeof fetch;

export class HttpAgentHeartbeatClient implements AgentHeartbeatClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  heartbeat(input: AgentHeartbeatConfig): Promise<AgentHeartbeatResponse> {
    return this.post(input);
  }

  private async post(
    input: AgentHeartbeatConfig,
  ): Promise<AgentHeartbeatResponse> {
    const response = await this.fetchImpl(this.url(input.apiUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-devpilot-agent-token": input.token,
      },
      body: JSON.stringify(this.body(input)),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message: unknown }).message)
          : response.statusText;
      throw new Error(`Devpilot heartbeat request failed: ${message}`);
    }
    return payload as AgentHeartbeatResponse;
  }

  private body(input: AgentHeartbeatConfig) {
    return {
      teamId: input.teamId,
      serverId: input.serverId,
      agentId: input.agentId,
      ...(input.runnerId ? { runnerId: input.runnerId } : {}),
      ...(input.capabilities.length
        ? { capabilities: input.capabilities }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.hostname ? { hostname: input.hostname } : {}),
      ...(input.version ? { version: input.version } : {}),
      ...(input.ttlSeconds ? { ttlSeconds: input.ttlSeconds } : {}),
    };
  }

  private url(apiUrl: string) {
    return `${apiUrl.replace(/\/+$/, "")}/server-agent/heartbeat`;
  }
}
