import { repositoryWorkloadContract } from "./repository-workload-contract.utils";

describe("repository workload contract", () => {
  it("creates a managed process and exact loopback health URL from one port", () => {
    expect(repositoryWorkloadContract(service(), { start: "node dist/main.js" })).toMatchObject({
      kind: "container",
      targetType: "server",
      workloadExecutionMode: "managed-process-v1",
      deployCommand: "node dist/main.js",
      healthCheckUrl: "http://127.0.0.1:3000/health",
    });
  });

  it("requires explicit status and cleanup together for managed command mode", () => {
    expect(repositoryWorkloadContract(service(), {
      start: "docker compose up -d",
      status: "docker compose ps --status running",
      cleanup: "docker compose down",
    })).toMatchObject({
      workloadExecutionMode: "managed-command-v1",
      statusCommand: "docker compose ps --status running",
      failureCleanupCommand: "docker compose down",
    });
    expect(repositoryWorkloadContract(service(), {
      start: "docker compose up -d",
      status: "docker compose ps --status running",
    })).toMatchObject({ workloadExecutionMode: "managed-process-v1" });
  });

  it("does not invent a health URL for ambiguous ports or unsafe paths", () => {
    expect(repositoryWorkloadContract(service({ ports: [3000, 3001] }), {
      start: "node server.js",
    })).not.toHaveProperty("healthCheckUrl");
    expect(repositoryWorkloadContract(service({ healthChecks: [{ path: "//evil.test" }] }), {
      start: "node server.js",
    })).not.toHaveProperty("healthCheckUrl");
  });
});

function service(overrides: Record<string, unknown> = {}) {
  return {
    ports: [3000],
    healthChecks: [{ path: "/health" }],
    container: { composeFiles: ["compose.yml"] },
    ...overrides,
  } as never;
}
