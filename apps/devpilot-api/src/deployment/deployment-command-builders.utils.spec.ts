import {
  buildCommandSteps,
  buildRollbackCommandSteps,
  type DeploymentConfig,
} from "./deployment-command-builders.utils";

const config: DeploymentConfig = {
  targetType: "server",
  workingDirectory: "/srv/app",
  buildCommand: "pnpm build",
  deployCommand:
    "docker compose -f docker-compose.devpilot.yml up -d --build backend",
  rollbackCommand:
    "docker compose -f docker-compose.devpilot.yml up -d --build backend",
  healthCheckUrl: "http://127.0.0.1:4100/api",
};

describe("buildCommandSteps with envVars", () => {
  it("inserts write_env before deploy and cleanup_env after health_check when envVars present", () => {
    const steps = buildCommandSteps(
      config,
      "git@example.com:repo/app.git",
      "main",
      { DATABASE_URL: "mysql://u:p@h/db" },
    );
    const keys = steps.map((s) => s.key);
    expect(keys).toEqual([
      "checkout",
      "build",
      "write_env",
      "deploy",
      "health_check",
      "cleanup_env",
    ]);
    const writeStep = steps.find((s) => s.key === "write_env")!;
    expect(writeStep.secretEnv).toEqual({ DATABASE_URL: "mysql://u:p@h/db" });
    expect(writeStep.command).toContain("***REDACTED***");
    expect(writeStep.command).not.toContain("mysql://u:p@h/db");
  });

  it("keeps lifecycle stages in fail-fast order before service startup", () => {
    const steps = buildCommandSteps(
      {
        ...config,
        preStartCheckCommand: "docker compose config --quiet",
        migrationCommand: "prisma migrate deploy",
        initializationCommand: "node dist/bootstrap.js",
      },
      "git@example.com:repo/app.git",
      "master",
      undefined,
      { status: "reserved", checkpointId: "init-1" },
    );

    expect(steps.map((step) => step.key)).toEqual([
      "checkout",
      "build",
      "pre_start_check",
      "migration",
      "initialization",
      "deploy",
      "health_check",
    ]);
    expect(steps.slice(2).every((step) => step.failurePolicy === "block")).toBe(
      true,
    );
    expect(steps.find((step) => step.key === "initialization")).toMatchObject({
      runPolicy: "once_per_environment_command",
      decision: "execute",
    });
  });

  it("retains an explicit skipped initialization stage after prior success", () => {
    const step = buildCommandSteps(
      { ...config, initializationCommand: "node dist/bootstrap.js" },
      undefined,
      undefined,
      undefined,
      {
        status: "skipped_already_completed",
        skipReason: "already completed",
      },
    ).find((item) => item.key === "initialization");

    expect(step).toMatchObject({
      command: "",
      required: false,
      decision: "skip",
      skipReason: "already completed",
    });
  });

  it("does not insert write_env / cleanup_env when envVars is empty or absent", () => {
    const keysWithout = buildCommandSteps(
      config,
      "git@x:y.git",
      "main",
      {},
    ).map((s) => s.key);
    expect(keysWithout).toEqual([
      "checkout",
      "build",
      "deploy",
      "health_check",
    ]);

    const keysAbsent = buildCommandSteps(config, "git@x:y.git", "main").map(
      (s) => s.key,
    );
    expect(keysAbsent).toEqual(["checkout", "build", "deploy", "health_check"]);
  });

  it("releaseApplicationOnly omits precheck/migration/initialization (F383 release bridge)", () => {
    const steps = buildCommandSteps(
      {
        ...config,
        preStartCheckCommand: "docker compose config --quiet",
        migrationCommand: "prisma migrate deploy",
        initializationCommand: "node dist/bootstrap.js",
      },
      "git@example.com:repo/app.git",
      "main",
      undefined,
      { status: "planned" },
      { releaseApplicationOnly: true },
    );
    const keys = steps.map((s) => s.key);
    expect(keys).toEqual(["checkout", "build", "deploy", "health_check"]);
    expect(keys).not.toContain("pre_start_check");
    expect(keys).not.toContain("migration");
    expect(keys).not.toContain("initialization");
  });
});

describe("buildRollbackCommandSteps with envVars", () => {
  it("inserts write_env before deploy_rollback and cleanup_env at the end", () => {
    const steps = buildRollbackCommandSteps(
      config,
      "git@example.com:repo/app.git",
      "abc1234567",
      { DATABASE_URL: "mysql://u:p@h/db" },
    );
    const keys = steps.map((s) => s.key);
    expect(keys).toEqual([
      "checkout_rollback",
      "build_rollback",
      "write_env",
      "deploy_rollback",
      "health_check",
      "cleanup_env",
    ]);
  });
});
