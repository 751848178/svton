/**
 * release-service-config + release-service-deps 单测（F383 Slice 8a + P0-1 + Item 1 fail-closed）。
 *
 * 命令字段读取测试在原位（readServiceDeployConfig）。跨服务依赖解析测试覆盖
 * Item 1 全部错误分支：畸形 / 缺字段 / 非法 stage / 非法 condition / 冲突重复（去重为幂等，
 * 冲突为 error）。服务级分支（自依赖 / 未选 / 不存在 / 跨域）由 release-dependency-resolver
 * 的 service 测试 + 控制器集成测试覆盖（需 DB）。
 */
import { readServiceDeployConfig } from "./release-service-config.utils";
import { readServiceReleaseDependencies } from "./release-service-deps.utils";

describe("readServiceDeployConfig", () => {
  it("reads flat top-level commands", () => {
    const cmds = readServiceDeployConfig({
      workingDirectory: "apps/backend",
      preStartCheckCommand: "make check",
      migrationCommand: "make migrate",
      deployCommand: "make deploy",
      healthCheckUrl: "http://h",
      backfillCommand: "make backfill",
      initializationCommand: "make bootstrap",
    });
    expect(cmds).toEqual({
      workingDirectory: "apps/backend",
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

describe("readServiceReleaseDependencies (P0-1 + Item 1 fail-closed)", () => {
  it("reads valid releaseDependencies from top-level array", () => {
    const { edges, errors } = readServiceReleaseDependencies({
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
    expect(errors).toEqual([]);
    expect(edges).toEqual([
      {
        toServiceId: "svc-admin",
        fromStageType: "health_check",
        toStageType: "application_deploy",
        conditionType: "succeeded",
        required: true,
        sourceIndex: 0,
      },
    ]);
  });

  it("merges top-level and nested deployment.releaseDependencies layers", () => {
    const { edges, errors } = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-a", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" },
      ],
      deployment: {
        releaseDependencies: [
          { toServiceId: "svc-b", fromStageType: "schema_migration", toStageType: "bootstrap", conditionType: "succeeded" },
        ],
      },
    });
    expect(errors).toEqual([]);
    expect(edges.map((e) => e.toServiceId).sort()).toEqual(["svc-a", "svc-b"]);
  });

  it("defaults required to true when omitted", () => {
    const { edges } = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-a", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "completed" },
      ],
    });
    expect(edges[0].required).toBe(true);
  });

  // Item 1 §1 畸形数据 → RELEASE_DEP_MALFORMED
  it("emits RELEASE_DEP_MALFORMED for non-object entries (not silent drop)", () => {
    const { edges, errors } = readServiceReleaseDependencies({
      releaseDependencies: ["not-an-object", null, 42],
    });
    expect(edges).toHaveLength(0);
    expect(errors).toHaveLength(3);
    expect(errors.every((e) => e.code === "RELEASE_DEP_MALFORMED")).toBe(true);
    expect(errors[0].dependencyIndex).toBe(0);
    expect(errors[0].invalidValue).toBe("not-an-object");
    expect(errors[0].suggestedAction).toMatch(/修正/);
  });

  // Item 1 §2 缺少必选字段 → RELEASE_DEP_MISSING_FIELD（带 field）
  it("emits RELEASE_DEP_MISSING_FIELD with field name per missing field", () => {
    const { errors } = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-b", fromStageType: "health_check" }, // missing toStageType/conditionType
        { fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" }, // missing toServiceId
      ],
    });
    expect(errors).toHaveLength(2);
    expect(errors[0].code).toBe("RELEASE_DEP_MISSING_FIELD");
    // 缺字段检测顺序固定为 toServiceId → fromStageType → toStageType → conditionType
    expect(errors[0].field).toBe("toStageType");
    expect(errors[0].dependencyIndex).toBe(0);
    expect(errors[1].field).toBe("toServiceId");
  });

  // Item 1 §3 非法 condition → RELEASE_DEP_INVALID_CONDITION_TYPE（带 allowedValues）
  it("emits RELEASE_DEP_INVALID_CONDITION_TYPE for unsupported condition", () => {
    const { errors } = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-c", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "unknown_condition" },
      ],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("RELEASE_DEP_INVALID_CONDITION_TYPE");
    expect(errors[0].field).toBe("conditionType");
    expect(errors[0].invalidValue).toBe("unknown_condition");
    expect(Array.isArray(errors[0].allowedValues)).toBe(true);
  });

  // Item 1 §3 非法 stage → RELEASE_DEP_INVALID_STAGE_TYPE（fromStageType / toStageType 分别覆盖）
  it("emits RELEASE_DEP_INVALID_STAGE_TYPE for unsupported from/to stage", () => {
    const { errors } = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-d", fromStageType: "bogus_type", toStageType: "application_deploy", conditionType: "succeeded" },
        { toServiceId: "svc-e", fromStageType: "health_check", toStageType: "made_up_stage", conditionType: "succeeded" },
      ],
    });
    expect(errors).toHaveLength(2);
    expect(errors[0].code).toBe("RELEASE_DEP_INVALID_STAGE_TYPE");
    expect(errors[0].field).toBe("fromStageType");
    expect(errors[1].field).toBe("toStageType");
  });

  // Item 1 §6 完全相同的重复 → 幂等去重（非错误）；冲突 → RELEASE_DEP_DUPLICATE_CONFLICT
  it("deduplicates identical edges silently (idempotent), flags conflicting dup as error", () => {
    const edge = {
      toServiceId: "svc-a",
      fromStageType: "health_check",
      toStageType: "application_deploy",
      conditionType: "succeeded",
    };
    const identical = readServiceReleaseDependencies({
      releaseDependencies: [edge],
      deployment: { releaseDependencies: [{ ...edge }] },
    });
    expect(identical.edges).toHaveLength(1);
    expect(identical.errors).toHaveLength(0);

    const conflict = readServiceReleaseDependencies({
      releaseDependencies: [
        { ...edge, required: true },
        { ...edge, required: false },
      ],
    });
    expect(conflict.edges).toHaveLength(1);
    expect(conflict.errors).toHaveLength(1);
    expect(conflict.errors[0].code).toBe("RELEASE_DEP_DUPLICATE_CONFLICT");
    expect(conflict.errors[0].conflictWithIndex).toBe(0);
    expect(conflict.errors[0].dependencyIndex).toBe(1);
    expect(conflict.errors[0].differingFields).toEqual(["required"]);
  });

  // 多错误混合 + 有效边共存：parser 收集全部错误，不阻断同批有效边收集
  it("collects multiple errors and valid edges in one pass", () => {
    const { edges, errors } = readServiceReleaseDependencies({
      releaseDependencies: [
        { toServiceId: "svc-ok", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "succeeded" },
        "garbage",
        { toServiceId: "svc-x", fromStageType: "health_check", toStageType: "application_deploy", conditionType: "nope" },
      ],
    });
    expect(edges.map((e) => e.toServiceId)).toEqual(["svc-ok"]);
    expect(errors.map((e) => e.code)).toEqual([
      "RELEASE_DEP_MALFORMED",
      "RELEASE_DEP_INVALID_CONDITION_TYPE",
    ]);
    expect(errors[0].dependencyIndex).toBe(1);
    expect(errors[1].dependencyIndex).toBe(2);
  });

  it("returns empty when no releaseDependencies declared (absent = no deps)", () => {
    expect(readServiceReleaseDependencies({ deployCommand: "x" })).toEqual({ edges: [], errors: [] });
    expect(readServiceReleaseDependencies(null)).toEqual({ edges: [], errors: [] });
  });

  // P0-2(a)：非数组 releaseDependencies 不再静默忽略——返回结构化错误（fail-closed）。
  it("returns INVALID_FIELD_TYPE error when releaseDependencies is non-array", () => {
    const r = readServiceReleaseDependencies({ releaseDependencies: "not-array" });
    expect(r.edges).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].code).toBe("RELEASE_DEP_INVALID_FIELD_TYPE");
    expect(r.errors[0].field).toBe("releaseDependencies");
    expect(r.errors[0].invalidValue).toBe("not-array");
  });
});
