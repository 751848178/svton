import type {
  AgentTaskPullAckResponse,
  AgentTaskPullClaimResponse,
  AgentTaskPullConfig,
  AgentTaskPullContractResponse,
  AgentTaskPullFinishPayload,
  AgentTaskPullFinishResponse,
  AgentTaskPullHttpClient,
  AgentTaskPullIdentity,
} from "./agent-task-pull-types";

type FetchLike = typeof fetch;

export class HttpAgentTaskPullClient implements AgentTaskPullHttpClient {
  constructor(
    private readonly config: Pick<AgentTaskPullConfig, "apiUrl" | "token">,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  contract(
    input: AgentTaskPullIdentity,
  ): Promise<AgentTaskPullContractResponse> {
    return this.post<AgentTaskPullContractResponse>(
      "/server-agent/task-pull/contract",
      this.identityBody(input),
    );
  }

  claim(input: AgentTaskPullIdentity): Promise<AgentTaskPullClaimResponse> {
    return this.post<AgentTaskPullClaimResponse>(
      "/server-agent/task-pull/claim",
      this.identityBody(input),
    );
  }

  ack(
    input: AgentTaskPullIdentity,
    jobId: string,
    progress?: unknown,
  ): Promise<AgentTaskPullAckResponse> {
    return this.post<AgentTaskPullAckResponse>("/server-agent/task-pull/ack", {
      ...this.identityBody(input),
      jobId,
      ...(progress !== undefined ? { progress } : {}),
    });
  }

  finish(
    input: AgentTaskPullIdentity,
    jobId: string,
    payload: AgentTaskPullFinishPayload,
  ): Promise<AgentTaskPullFinishResponse> {
    return this.post<AgentTaskPullFinishResponse>(
      "/server-agent/task-pull/finish",
      {
        ...this.identityBody(input),
        jobId,
        ...payload,
      },
    );
  }

  private identityBody(input: AgentTaskPullIdentity) {
    return {
      teamId: input.teamId,
      serverId: input.serverId,
      agentId: input.agentId,
      ...(input.runnerId ? { runnerId: input.runnerId } : {}),
      ...(input.capabilities.length
        ? { capabilities: input.capabilities }
        : {}),
    };
  }

  private async post<T = unknown>(pathname: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(this.url(pathname), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-devpilot-agent-task-pull-token": this.config.token,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message: unknown }).message)
          : response.statusText;
      throw new Error(`Devpilot task-pull request failed: ${message}`);
    }
    return payload as T;
  }

  private url(pathname: string) {
    return `${this.config.apiUrl.replace(/\/+$/, "")}${pathname}`;
  }
}
