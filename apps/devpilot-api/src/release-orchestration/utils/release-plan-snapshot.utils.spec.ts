/**
 * P0-2 回归测试：planHash 必须绑定依赖图。
 *
 * 旧实现 inputSnapshot 不含 serviceDependencies/dependencies，导致无/有跨服务边
 * 产生相同 planHash（可预览一种依赖、再创建另一种而不触发 RELEASE_PLAN_STALE）。
 * 本套件验证 hash 对依赖图变化敏感、对声明顺序无关，且 snapshot 不含秘密。
 */
import { buildReleasePlan } from "./release-plan-builder.utils";
import { buildCanonicalPlanSnapshot } from "./release-plan-snapshot.utils";
import type { ReleaseServiceInput } from "./release-plan-builder.utils";
import type { ServiceDependencyEdge } from "./release-cross-service-edges.utils";

function picshareServices(): ReleaseServiceInput[] {
  return [
    {
      applicationId: "app-backend",
      applicationServiceId: "svc-backend",
      environmentId: "env-prod",
      serverId: "srv-1",
      serviceName: "backend",
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

const crossEdge: ServiceDependencyEdge = {
  fromServiceId: "svc-backend",
  fromStageType: "health_check",
  toServiceId: "svc-admin",
  toStageType: "application_deploy",
  conditionType: "succeeded",
  required: true,
};

describe("P0-2 planHash binds dependency graph", () => {
  it("hash DIFFERS: no cross-service edge vs with edge", () => {
    const without = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1", services: picshareServices(),
    });
    const withEdge = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [crossEdge],
    });
    expect(without.ok && withEdge.ok).toBe(true);
    if (!without.ok || !withEdge.ok) return;
    expect(without.value.planHash).not.toBe(withEdge.value.planHash);
  });

  it("hash DIFFERS: changing dependency endpoint (toStageType)", () => {
    // 同样的 from（backend:health_check）+ 同一下游服务，但下游阶段类型不同。
    // 需要 admin 同时拥有 application_deploy 和 health_check 阶段（都来自 deployCommand+healthCheckUrl）。
    const a = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [crossEdge],
    });
    const b = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(),
      serviceDependencies: [
        { ...crossEdge, toStageType: "health_check" },
      ],
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.planHash).not.toBe(b.value.planHash);
  });

  it("hash DIFFERS: changing conditionType", () => {
    const succeeded = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [crossEdge],
    });
    const completed = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(),
      serviceDependencies: [{ ...crossEdge, conditionType: "completed" }],
    });
    expect(succeeded.ok && completed.ok).toBe(true);
    if (!succeeded.ok || !completed.ok) return;
    expect(succeeded.value.planHash).not.toBe(completed.value.planHash);
  });

  it("hash DIFFERS: changing required flag", () => {
    const req = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [{ ...crossEdge, required: true }],
    });
    const opt = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [{ ...crossEdge, required: false }],
    });
    expect(req.ok && opt.ok).toBe(true);
    if (!req.ok || !opt.ok) return;
    expect(req.value.planHash).not.toBe(opt.value.planHash);
  });

  it("hash SAME: only declaration order differs (normalized)", () => {
    // 两条无关节点，颠倒顺序 → 相同 hash
    const edge1: ServiceDependencyEdge = {
      fromServiceId: "svc-backend", fromStageType: "health_check",
      toServiceId: "svc-admin", toStageType: "application_deploy",
      conditionType: "succeeded", required: true,
    };
    // 第二条边需要不同的端点避免与 edge1 重复；用 backend schema_migration → admin bootstrap
    const services2 = picshareServices().map((s) => ({
      ...s,
      migrationCommand: s.applicationServiceId === "svc-backend" ? "make migrate" : undefined,
      initializationCommand: s.applicationServiceId === "svc-admin" ? "make bootstrap" : undefined,
    }));
    const edge2: ServiceDependencyEdge = {
      fromServiceId: "svc-backend", fromStageType: "schema_migration",
      toServiceId: "svc-admin", toStageType: "bootstrap",
      conditionType: "succeeded", required: true,
    };
    const orderA = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: services2, serviceDependencies: [edge1, edge2],
    });
    const orderB = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: services2, serviceDependencies: [edge2, edge1],
    });
    expect(orderA.ok && orderB.ok).toBe(true);
    if (!orderA.ok || !orderB.ok) return;
    expect(orderA.value.planHash).toBe(orderB.value.planHash);
  });

  it("hash DIFFERS: changing service selection (add a service)", () => {
    const one = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: [picshareServices()[0]],
    });
    const two = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(),
    });
    expect(one.ok && two.ok).toBe(true);
    if (!one.ok || !two.ok) return;
    expect(one.value.planHash).not.toBe(two.value.planHash);
  });

  it("hash DIFFERS: changing command (via stage configHash)", () => {
    const svcs = picshareServices();
    const a = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1", services: svcs,
    });
    const b = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: svcs.map((s) =>
        s.applicationServiceId === "svc-backend"
          ? { ...s, deployCommand: "make deploy-backend-v2" }
          : s,
      ),
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.planHash).not.toBe(b.value.planHash);
  });
});

describe("P0-2 canonical snapshot excludes secrets & volatile fields", () => {
  it("canonical snapshot has no raw shell command, no generatedAt; services are selectors only", () => {
    const r = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: [
        {
          applicationId: "app-backend", applicationServiceId: "svc-backend",
          environmentId: "env-prod", serviceName: "backend",
          deployCommand: "JWT_SECRET=x make deploy",
          healthCheckUrl: "http://backend/healthz",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const snap = buildCanonicalPlanSnapshot({
      input: {
        projectId: "p1", environmentId: "env-prod", name: "r1",
        services: [
          {
            applicationId: "app-backend", applicationServiceId: "svc-backend",
            environmentId: "env-prod", serviceName: "backend",
            deployCommand: "JWT_SECRET=x make deploy",
          },
        ],
        serviceDependencies: [],
      },
      stages: r.value.stages,
      dependencies: r.value.dependencies,
      approvalRequired: r.value.approvalRequired,
    });
    const json = JSON.stringify(snap);
    // canonical snapshot services hold only selector fields — no raw command
    expect(json).not.toContain("JWT_SECRET=x make deploy");
    expect(json).not.toContain("generatedAt");
    // command is covered indirectly by stage.configHash (present, hex)
    const stageEntry = (snap as { stages: Array<{ configHash: string }> }).stages[0];
    expect(stageEntry.configHash).toMatch(/^[0-9a-f]+$/);
  });

  it("returned preview planHash is stable across two calls (deterministic)", () => {
    const a = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [crossEdge],
    });
    const b = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [crossEdge],
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.planHash).toBe(b.value.planHash);
  });
});

describe("P0-2(b) planHash binds dependency warnings", () => {
  it("hash DIFFERS: no warnings vs with an optional-target warning", () => {
    // 同样的服务+边，但一次带 optional 警告、一次不带 → planHash 必须不同。
    // 这保证 preview 与 create 之间 warnings 变化会触发 RELEASE_PLAN_STALE。
    const base = {
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [crossEdge],
    };
    const without = buildReleasePlan(base);
    const withWarning = buildReleasePlan({
      ...base,
      dependencyWarnings: [
        {
          code: "RELEASE_DEP_TARGET_NOT_SELECTED",
          applicationServiceId: "svc-backend",
          serviceName: "backend",
          dependencyIndex: 0,
          toServiceId: "svc-ghost",
          reason: "optional target not in selection",
          suggestedAction: "可选依赖未选，已跳过",
        },
      ],
    });
    expect(without.ok && withWarning.ok).toBe(true);
    if (!without.ok || !withWarning.ok) return;
    expect(without.value.planHash).not.toBe(withWarning.value.planHash);
  });

  it("preview warnings field populated when dependencyWarnings provided", () => {
    const r = buildReleasePlan({
      projectId: "p1", environmentId: "env-prod", name: "r1",
      services: picshareServices(), serviceDependencies: [crossEdge],
      dependencyWarnings: [
        {
          code: "RELEASE_DEP_TARGET_NOT_SELECTED",
          applicationServiceId: "svc-backend", serviceName: "backend",
          dependencyIndex: 0, toServiceId: "svc-ghost",
          reason: "x", suggestedAction: "y",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.warnings).toHaveLength(1);
    expect(r.value.warnings[0].toServiceId).toBe("svc-ghost");
  });
});
