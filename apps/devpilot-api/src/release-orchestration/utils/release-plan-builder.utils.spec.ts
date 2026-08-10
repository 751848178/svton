import { buildReleasePlan } from "./release-plan-builder.utils";
import type { ReleaseServiceInput } from "./release-plan-builder.utils";
import { evaluateDependencyCondition } from "./release-readiness.utils";
import { computeIdempotencyKey } from "./release-hash.utils";

// Picshare 参考图：config-check → migration → bootstrap → backfill(optional)
// → backend-deploy → backend-readiness；admin 链同理
function picshareServices(): ReleaseServiceInput[] {
  return [
    {
      applicationId: "app-backend",
      applicationServiceId: "svc-backend",
      environmentId: "env-prod",
      serverId: "srv-1",
      serviceName: "backend",
      workingDirectory: "apps/backend",
      preStartCheckCommand: "make config-check",
      migrationCommand: "make db-migrate",
      initializationCommand: "make bootstrap",
      backfillCommand: "make backfill-photos",
      backfillRequired: false,
      deployCommand: "make deploy-backend",
      healthCheckUrl: "http://backend/healthz",
    },
    {
      applicationId: "app-admin",
      applicationServiceId: "svc-admin",
      environmentId: "env-prod",
      serverId: "srv-1",
      serviceName: "admin",
      deployCommand: "make deploy-admin",
      healthCheckUrl: "http://admin/healthz",
    },
  ];
}

describe("release-plan-builder buildReleasePlan", () => {
  it("produces the Picshare reference DAG with correct keys", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "release-1",
      services: picshareServices(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = r.value.stages.map((s) => s.key);
    expect(keys).toContain("precheck:svc-backend");
    expect(keys).toContain("schema_migration:svc-backend");
    expect(keys).toContain("bootstrap:svc-backend");
    expect(keys).toContain("data_backfill:svc-backend");
    expect(keys).toContain("application_deploy:svc-backend");
    expect(keys).toContain("health_check:svc-backend");
    expect(keys).toContain("application_deploy:svc-admin");
    expect(keys).toContain("health_check:svc-admin");
    for (const type of ["schema_migration", "bootstrap", "data_backfill"]) {
      expect(r.value.stages.find((stage) => stage.type === type)?.configSnapshot)
        .toMatchObject({ workingDirectory: "apps/backend" });
    }
  });

  // F383 P0-A 回归：schema_migration 的 configSnapshot.command 必须在 builder 层就地脱敏，
  // 内联 DB 密码改写为 $DEVPILOT_DATABASE_URL 占位——明文秘密绝不进入持久化模型。
  // 真实值在执行边界由 ReleaseCredentialResolverService 解析并经 step.secretEnvExport
  // （仅内存，落库前被 stripSecretEnv 剥离）注入。
  it("redacts the inline DB password in schema_migration configSnapshot.command to a placeholder", () => {
    const withPassword: ReleaseServiceInput[] = [
      {
        applicationId: "app-backend",
        applicationServiceId: "svc-backend",
        environmentId: "env-prod",
        serverId: "srv-1",
        serviceName: "backend",
        migrationCommand:
          "docker run -e DATABASE_URL=\"mysql://root:s3cret-pw@db:3306/app\" migrate",
      },
    ];
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "release-pw",
      services: withPassword,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mig = r.value.stages.find((s) => s.key === "schema_migration:svc-backend");
    expect(mig?.configSnapshot?.command).toContain("$DEVPILOT_DATABASE_URL");
    expect(mig?.configSnapshot?.command).not.toContain("s3cret-pw");
    expect(mig?.configSnapshot?.command).not.toContain("root:s3cret-pw@");
  });

  it("chains backend stages in dependency order", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: picshareServices(),
    });
    if (!r.ok) return;
    const dep = (k: string) =>
      r.value.dependencies
        .filter((d) => d.stageKey === k)
        .map((d) => d.dependsOnStageKey);
    expect(dep("schema_migration:svc-backend")).toContain(
      "precheck:svc-backend",
    );
    expect(dep("bootstrap:svc-backend")).toContain(
      "schema_migration:svc-backend",
    );
    expect(dep("data_backfill:svc-backend")).toContain(
      "bootstrap:svc-backend",
    );
    expect(dep("application_deploy:svc-backend")).toContain(
      "data_backfill:svc-backend",
    );
    expect(dep("health_check:svc-backend")).toContain(
      "application_deploy:svc-backend",
    );
  });

  it("marks backfill optional with completed dependency", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: picshareServices(),
    });
    if (!r.ok) return;
    const stage = r.value.stages.find((s) => s.key === "data_backfill:svc-backend");
    expect(stage?.required).toBe(false);
    const edge = r.value.dependencies.find(
      (d) => d.stageKey === "data_backfill:svc-backend",
    );
    expect(edge?.conditionType).toBe("completed");
  });

  it("does not invent stages for unconfigured commands", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "e1",
      name: "r",
      services: [
        {
          applicationId: "a",
          applicationServiceId: "s",
          environmentId: "e1",
          serviceName: "svc",
          deployCommand: "deploy",
        },
      ],
    });
    if (!r.ok) return;
    const keys = r.value.stages.map((s) => s.key);
    expect(keys).toEqual(["application_deploy:s"]);
  });

  it("computes stable planHash for same input", () => {
    const a = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: picshareServices(),
    });
    const b = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: picshareServices(),
    });
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.value.planHash).toBe(b.value.planHash);
  });

  it("different config yields different planHash", () => {
    const base = {
      projectId: "p1",
      environmentId: "e1",
      name: "r",
    };
    const a = buildReleasePlan({
      ...base,
      services: [
        {
          applicationId: "a",
          applicationServiceId: "s",
          environmentId: "e1",
          serviceName: "svc",
          deployCommand: "deploy-v1",
        },
      ],
    });
    const b = buildReleasePlan({
      ...base,
      services: [
        {
          applicationId: "a",
          applicationServiceId: "s",
          environmentId: "e1",
          serviceName: "svc",
          deployCommand: "deploy-v2",
        },
      ],
    });
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.value.planHash).not.toBe(b.value.planHash);
  });

  it("records side effects and approval requirements for risk stages", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "e1",
      name: "r",
      services: picshareServices(),
    });
    if (!r.ok) return;
    expect(
      r.value.sideEffects.some((s) => s.startsWith("schema_migration:")),
    ).toBe(true);
    expect(
      r.value.approvalRequired.some((a) =>
        a.stageKey.startsWith("schema_migration:"),
      ),
    ).toBe(true);
  });

  it("returns error when no stages produced", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "e1",
      name: "r",
      services: [
        {
          applicationId: "a",
          applicationServiceId: "s",
          environmentId: "e1",
          serviceName: "svc",
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  // --- Slice 8a: builder-level env consistency (invest-3 §A.2) ---
  it("rejects service whose environmentId differs from plan target (defensive)", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: [
        {
          applicationId: "a",
          applicationServiceId: "svc-dev",
          environmentId: "env-dev",
          serviceName: "svc",
          deployCommand: "make deploy",
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("missing_reference");
    expect(r.error.message).toContain("svc-dev");
  });

  // --- Slice 2: cross-service DAG ---
  it("emits declared cross-service edge (Picshare backend-readiness → admin-deploy)", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "release-1",
      services: picshareServices(),
      serviceDependencies: [
        {
          fromServiceId: "svc-backend",
          fromStageType: "health_check",
          toServiceId: "svc-admin",
          toStageType: "application_deploy",
          conditionType: "succeeded",
          required: true,
        },
      ],
    });
    if (!r.ok) throw new Error("expected ok");
    const cross = r.value.dependencies.find(
      (d) =>
        d.stageKey === "application_deploy:svc-admin" &&
        d.dependsOnStageKey === "health_check:svc-backend",
    );
    expect(cross).toBeTruthy();
    expect(cross?.conditionType).toBe("succeeded");
    expect(cross?.required).toBe(true);
  });

  it("returns missing_reference when cross-service edge targets an unknown service", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "release-1",
      services: picshareServices(),
      serviceDependencies: [
        {
          fromServiceId: "svc-backend",
          fromStageType: "health_check",
          toServiceId: "svc-does-not-exist",
          toStageType: "application_deploy",
          conditionType: "succeeded",
          required: true,
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("missing_reference");
    expect(r.error.message).toContain("svc-does-not-exist");
  });

  // --- Slice 2: optional backfill skip matrix (invest-2 §C.3) ---
  it("optional backfill outgoing edge uses completed+optional (skipped lets deploy proceed)", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: [
        {
          applicationId: "app-backend",
          applicationServiceId: "svc-backend",
          environmentId: "env-prod",
          serviceName: "backend",
          initializationCommand: "make bootstrap",
          backfillCommand: "make backfill",
          backfillRequired: false,
          deployCommand: "make deploy",
        },
      ],
    });
    if (!r.ok) throw new Error("expected ok");
    const out = r.value.dependencies.find(
      (d) =>
        d.stageKey === "application_deploy:svc-backend" &&
        d.dependsOnStageKey === "data_backfill:svc-backend",
    );
    expect(out).toBeTruthy();
    expect(out?.conditionType).toBe("completed");
    expect(out?.required).toBe(false);
    // skipped backfill satisfies completed → deploy proceeds
    expect(evaluateDependencyCondition("completed", "skipped", null, false)).toBe(true);
    // failed backfill does NOT satisfy completed → deploy blocked
    expect(evaluateDependencyCondition("completed", "failed", null, false)).toBe(false);
  });

  it("required backfill outgoing edge uses succeeded+required", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: [
        {
          applicationId: "app-backend",
          applicationServiceId: "svc-backend",
          environmentId: "env-prod",
          serviceName: "backend",
          initializationCommand: "make bootstrap",
          backfillCommand: "make backfill",
          backfillRequired: true,
          deployCommand: "make deploy",
        },
      ],
    });
    if (!r.ok) throw new Error("expected ok");
    const out = r.value.dependencies.find(
      (d) =>
        d.stageKey === "application_deploy:svc-backend" &&
        d.dependsOnStageKey === "data_backfill:svc-backend",
    );
    expect(out).toBeTruthy();
    expect(out?.conditionType).toBe("succeeded");
    expect(out?.required).toBe(true);
    expect(evaluateDependencyCondition("succeeded", "succeeded", null, false)).toBe(true);
  });

  // --- Slice 2: branch/commitSha/gitRepo propagation ---
  it("propagates branch/commitSha/gitRepo into deploy stage configSnapshot", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      branch: "master",
      commitSha: "abc123",
      gitRepo: "git@example.com:r.git",
      services: [
        {
          applicationId: "app-backend",
          applicationServiceId: "svc-backend",
          environmentId: "env-prod",
          serviceName: "backend",
          deployCommand: "make deploy",
        },
      ],
    });
    if (!r.ok) throw new Error("expected ok");
    const deploy = r.value.stages.find((s) => s.key === "application_deploy:svc-backend");
    expect(deploy).toBeTruthy();
    const cfg = deploy?.configSnapshot as Record<string, unknown>;
    expect(cfg.branch).toBe("master");
    expect(cfg.commitSha).toBe("abc123");
    expect(cfg.gitRepo).toBe("git@example.com:r.git");
    // gitRepo captured in plan inputSnapshot too
    expect((r.value.inputSnapshot as Record<string, unknown>).gitRepo).toBe(
      "git@example.com:r.git",
    );
  });

  // --- Slice 2: idempotencyKey placeholder at preview time ---
  it("preview stages carry __plan__ placeholder idempotencyKey (recomputed at persist)", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "r",
      services: [
        {
          applicationId: "a",
          applicationServiceId: "s",
          environmentId: "env-prod",
          serviceName: "svc",
          deployCommand: "deploy",
        },
      ],
    });
    if (!r.ok) throw new Error("expected ok");
    const stage = r.value.stages[0];
    // preview-time placeholder; repository.persistPlanWithStages recomputes with plan.id
    expect(stage.idempotencyKey).toBe(
      computeIdempotencyKey("__plan__", stage.key, stage.configHash ?? ""),
    );
  });

  // CR-3-F1 回归：空 services → ok:false（DTO @ArrayMinSize(1) 的纯函数第二道闸）
  it("CR-3-F1: empty services → !ok (missing_reference)", () => {
    const r = buildReleasePlan({
      projectId: "p1",
      environmentId: "env-prod",
      name: "empty-plan",
      services: [],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("missing_reference");
    expect(r.error.message).toContain("至少选择一个应用服务");
  });
});
