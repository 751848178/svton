/**
 * release-service-config 单测：命令字段读取（已有逻辑）+ 跨服务依赖读取（P0-1）。
 */
import {
  readServiceDeployConfig,
  readServiceReleaseDependencies,
} from "./release-service-config.utils";

describe("readServiceDeployConfig", () => {
  it("reads flat top-level commands", () => {
    const cmds = readServiceDeployConfig({
      preStartCheckCommand: "make check",
      migrationCommand: "make migrate",
      deployCommand: "make deploy",
      healthCheckUrl: "http://h",
      backfillCommand: "make backfill",
      initializationCommand: "make bootstrap",
    });
    expect(cmds).toEqual({
      preStartCheckCommand: "make check",
      migrationCommand: "make migrate",
      initializationCommand: "make bootstrap",
      deployCommand: "make deploy",
      healthCheckUrl: "http://h",
      backfillCommand: "make backfill",
    });
  });

  it("reads from nested deployment object when top-level absent", () => {
    const cmds = readServiceDeployConfig({
      deployment: { deployCommand: "make deploy-nested", healthCheckUrl: "http://h2" },
    });
    expect(cmds.deployCommand).toBe("make deploy-nested");
    expect(cmds.healthCheckUrl).toBe("http://h2");
  });

  it("returns empty for null/array/primitive", () => {
    expect(readServiceDeployConfig(null)).toEqual({});
    expect(readServiceDeployConfig([1, 2])).toEqual({});
    expect(readServiceDeployConfig("str")).toEqual({});
  });
});

describe("readServiceReleaseDependencies (P0-1)", () => {
  it("reads releaseDependencies from top-level array", () => {
    const edges = readServiceReleaseDependencies({
      deployCommand: "make deploy",
      releaseDependencies: [
        {
          toServiceId: "svc-admin",
          fromStageType: "health_check",
          toStageType: "application_deploy",
          conditionType: "succeeded",
          required: true,
        },
      ],
    });
    expect(edges).toEqual([
      {
        toServiceId: "svc-admin",
        fromStageType: "health_check",
        toStageType: "application_deploy",
        conditionType: "succeeded",
        required: true,
      },
    ]);
  });

  it("reads from nested deployment.releaseDependencies too (merges both layers)", () => {
    const edges = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-a", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" },
      ],
      deployment: {
        releaseDependencies: [
          { toServiceId: "svc-b", fromStageType: "schema_migration", toStageType: "bootstrap", conditionType: "succeeded" },
        ],
      },
    });
    expect(edges.map((e) => e.toServiceId).sort()).toEqual(["svc-a", "svc-b"]);
  });

  it("defaults required to true when omitted", () => {
    const edges = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-a", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "completed" },
      ],
    });
    expect(edges[0].required).toBe(true);
  });

  it("drops malformed / missing-field entries silently", () => {
    const edges = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-a", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" },
        { toServiceId: "svc-b", fromStageType: "health_check" }, // missing toStageType/conditionType
        { fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" }, // missing toServiceId
        "not-an-object",
        null,
        { toServiceId: "svc-c", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "unknown_condition" }, // invalid conditionType
        { toServiceId: "svc-d", fromStageType: "bogus_type", toStageType: "application_deploy", conditionType: "succeeded" }, // invalid stage type
      ],
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].toServiceId).toBe("svc-a");
  });

  it("deduplicates identical edges across layers", () => {
    const edge = {
      toServiceId: "svc-a",
      fromStageType: "health_check",
      toStageType: "application_deploy",
      conditionType: "succeeded",
    };
    const edges = readServiceReleaseDependencies({
      releaseDependencies: [edge],
      deployment: { releaseDependencies: [{ ...edge }] },
    });
    expect(edges).toHaveLength(1);
  });

  it("returns [] when no releaseDependencies declared", () => {
    expect(readServiceReleaseDependencies({ deployCommand: "x" })).toEqual([]);
    expect(readServiceReleaseDependencies(null)).toEqual([]);
    expect(readServiceReleaseDependencies({ releaseDependencies: "not-array" })).toEqual([]);
  });
});
