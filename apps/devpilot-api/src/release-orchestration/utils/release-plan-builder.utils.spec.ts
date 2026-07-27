import { buildReleasePlan } from "./release-plan-builder.utils";
import type { ReleaseServiceInput } from "./release-plan-builder.utils";

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
      environmentId: "e1",
      name: "r",
      services: picshareServices(),
    });
    const b = buildReleasePlan({
      projectId: "p1",
      environmentId: "e1",
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
});
