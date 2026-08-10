import { UnprocessableEntityException } from "@nestjs/common";
import { buildReleaseStagingWorkloadSnapshot } from "./release-staging-workload-snapshot.utils";

describe("release staging workload snapshot", () => {
  it("binds active staging services to exact Manifest components", () => {
    const snapshot = buildReleaseStagingWorkloadSnapshot(state() as never);
    expect(snapshot).toMatchObject({
      version: 1,
      environmentId: "staging-1",
      manifestId: "manifest-1",
      services: [
        {
          serviceId: "service-api",
          componentKey: "service-api",
          executionMode: "managed-process-v1",
          workingDirectory: "dist/api",
          health: {
            url: "http://127.0.0.1:4310/health",
            origin: "http://127.0.0.1:4310",
          },
        },
        {
          serviceId: "service-worker",
          executionMode: "managed-command-v1",
          statusCommand: "./worker-status.sh",
        },
      ],
    });
    expect(snapshot.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      snapshot.services.every((item) => item.stateHash.length === 64),
    ).toBe(true);
  });

  it.each([
    ["missing component", () => state({ items: [] })],
    [
      "source build command",
      () => state({ deployCommand: "git pull && pnpm build" }),
    ],
    ["outside directory", () => state({ workingDirectory: "../source" })],
    [
      "absolute source command",
      () => state({ deployCommand: "node /workspace/source/server.js" }),
    ],
    [
      "parent source command",
      () => state({ deployCommand: "node ../source/server.js" }),
    ],
    ["directory shell command", () => state({ deployCommand: "cd source" })],
    ["inline shell command", () => state({ deployCommand: "sh -c source.sh" })],
    [
      "scheme-less curl download",
      () =>
        state({ deployCommand: "curl -o payload.js example.com/payload.js" }),
    ],
    [
      "scheme-less wget download",
      () =>
        state({ deployCommand: "wget example.com/payload.js -O payload.js" }),
    ],
    ["npm install", () => state({ deployCommand: "npm install payload" })],
    ["pnpm install", () => state({ deployCommand: "pnpm install payload" })],
    ["yarn install", () => state({ deployCommand: "yarn install payload" })],
    [
      "inline environment literal",
      () => state({ deployCommand: "API_TOKEN=value node server.js" }),
    ],
    [
      "command mode without status",
      () => state({ workerStatusCommand: undefined }),
    ],
    [
      "command mode without cleanup",
      () => state({ workerCleanupCommand: undefined }),
    ],
  ])("rejects %s before a DeploymentRun can be reserved", (_label, value) => {
    expect(() => buildReleaseStagingWorkloadSnapshot(value() as never)).toThrow(
      UnprocessableEntityException,
    );
  });

  it("rejects health URLs that could persist credentials or query tokens", () => {
    expect(() =>
      buildReleaseStagingWorkloadSnapshot(
        state({
          healthCheckUrl: "https://user:pass@example.test/health?q=x",
        }) as never,
      ),
    ).toThrow(/不含凭据/);
  });

  it.each(["https://example.com/health", "http://10.0.0.8:4310/health"])(
    "rejects a health URL that is not target-local: %s",
    (healthCheckUrl) => {
      expect(() =>
        buildReleaseStagingWorkloadSnapshot(state({ healthCheckUrl }) as never),
      ).toThrow(/目标机回环地址/);
    },
  );
});

function state(overrides: Record<string, unknown> = {}) {
  const items = (overrides.items as unknown[]) || [
    item("service-api", "a"),
    item("service-worker", "b"),
  ];
  return {
    environment: {
      id: "staging-1",
      applicationServices: [
        {
          id: "service-api",
          applicationId: "application-1",
          name: "api",
          kind: "static",
          deployConfig: {
            workingDirectory: overrides.workingDirectory || "dist/api",
            deployCommand: overrides.deployCommand || "node server.js",
            healthCheckUrl:
              overrides.healthCheckUrl || "http://127.0.0.1:4310/health",
          },
        },
        {
          id: "service-worker",
          applicationId: "application-1",
          name: "worker",
          kind: "container",
          deployConfig: {
            deployCommand: "./start-worker.sh",
            statusCommand:
              "workerStatusCommand" in overrides
                ? overrides.workerStatusCommand
                : "./worker-status.sh",
            failureCleanupCommand:
              "workerCleanupCommand" in overrides
                ? overrides.workerCleanupCommand
                : "./worker-cleanup.sh",
          },
        },
      ],
    },
    manifest: {
      id: "manifest-1",
      digest: `sha256:${"f".repeat(64)}`,
      items,
    },
  };
}

function item(componentKey: string, fill: string) {
  return {
    componentKey,
    artifactType: "zip",
    digest: `sha256:${fill.repeat(64)}`,
    metadata: {},
  };
}
