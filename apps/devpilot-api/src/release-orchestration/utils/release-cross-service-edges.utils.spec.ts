/**
 * release-cross-service-edges 单测（P0-1）：声明式边 → 阶段键边解析。
 */
import {
  resolveCrossServiceEdges,
  stageKeyOf,
  type ServiceDependencyEdge,
} from "./release-cross-service-edges.utils";

const edge = (
  fromServiceId: string,
  fromStageType: string,
  toServiceId: string,
  toStageType: string,
  over: Partial<ServiceDependencyEdge> = {},
): ServiceDependencyEdge => ({
  fromServiceId,
  fromStageType: fromStageType as never,
  toServiceId,
  toStageType: toStageType as never,
  conditionType: "succeeded",
  required: true,
  ...over,
});

describe("stageKeyOf", () => {
  it("produces <stageType>:<serviceId>", () => {
    expect(stageKeyOf("health_check", "svc-backend")).toBe("health_check:svc-backend");
  });
});

describe("resolveCrossServiceEdges", () => {
  it("resolves Picshare backend-readiness → admin-deploy edge", () => {
    const known = new Set([
      "health_check:svc-backend",
      "application_deploy:svc-backend",
      "application_deploy:svc-admin",
      "health_check:svc-admin",
    ]);
    const edges = [
      edge("svc-backend", "health_check", "svc-admin", "application_deploy"),
    ];
    const r = resolveCrossServiceEdges(edges, known);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.edges).toEqual([
      {
        stageKey: "application_deploy:svc-admin",
        dependsOnStageKey: "health_check:svc-backend",
        conditionType: "succeeded",
        required: true,
      },
    ]);
  });

  it("rejects when upstream stage key not present", () => {
    const known = new Set(["application_deploy:svc-admin"]);
    const r = resolveCrossServiceEdges(
      [edge("svc-backend", "health_check", "svc-admin", "application_deploy")],
      known,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("missing_reference");
    expect(r.message).toContain("health_check:svc-backend");
  });

  it("rejects when downstream stage key not present", () => {
    const known = new Set(["health_check:svc-backend"]);
    const r = resolveCrossServiceEdges(
      [edge("svc-backend", "health_check", "svc-admin", "application_deploy")],
      known,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("application_deploy:svc-admin");
  });

  it("honors required=false (optional edge)", () => {
    const known = new Set(["health_check:svc-a", "application_deploy:svc-b"]);
    const r = resolveCrossServiceEdges(
      [edge("svc-a", "health_check", "svc-b", "application_deploy", { required: false })],
      known,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.edges[0].required).toBe(false);
  });

  it("supports multiple condition types", () => {
    const known = new Set([
      "health_check:svc-a",
      "application_deploy:svc-b",
      "data_backfill:svc-c",
    ]);
    const r = resolveCrossServiceEdges(
      [
        edge("svc-a", "health_check", "svc-b", "application_deploy", { conditionType: "completed" }),
        edge("svc-a", "health_check", "svc-c", "data_backfill", { conditionType: "output_match", required: false }),
      ],
      known,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.edges).toHaveLength(2);
    expect(r.edges.find((e) => e.stageKey === "data_backfill:svc-c")?.conditionType).toBe("output_match");
  });
});
