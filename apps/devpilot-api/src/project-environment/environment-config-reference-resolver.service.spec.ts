import { BadRequestException } from "@nestjs/common";
import { EnvironmentConfigReferenceResolverService } from "./environment-config-reference-resolver.service";

/**
 * F446 AC-SET-028 (cross-project rejection) and AC-SET-026 (explicit shared
 * scope + production anti-share rule) focused spec for the reference resolver.
 *
 * The resolver is the single server-side gate for every reference that enters
 * an immutable config revision, so foreign project/team references, shared
 * scope violations, and the production anti-share rule are asserted here.
 */

function txWith(kind: "managed_resource" | "resource_instance") {
  return {
    secretKey: { findMany: jest.fn().mockResolvedValue([]) },
    projectEnvironment: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.map((id: string) => ({ id }))),
      ),
    },
    managedResource: {
      findFirst: jest.fn().mockImplementation(kind === "managed_resource"
        ? jest.fn()
        : jest.fn().mockResolvedValue(null)),
    },
    resourceInstance: {
      findFirst: jest.fn().mockImplementation(kind === "resource_instance"
        ? jest.fn()
        : jest.fn().mockResolvedValue(null)),
    },
    site: { findFirst: jest.fn().mockResolvedValue(null) },
    cDNConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    controlAccessPolicy: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function scope(overrides: Record<string, unknown> = {}) {
  return { id: "env-1", teamId: "team-1", projectId: "project-1", ...overrides };
}

describe("EnvironmentConfigReferenceResolverService (AC-SET-026/028)", () => {
  it("accepts explicit resource template mapping and stores its component", async () => {
    const tx = txWith("resource_instance");
    tx.resourceInstance.findFirst.mockResolvedValue({
      id: "db-1", name: "database", environmentId: "env-1",
      resourceType: { envTemplate: "DATABASE_URL=${url}\nDATABASE_HOST=${host}" },
    });
    const resolver = new EnvironmentConfigReferenceResolverService();
    const result = await resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "resource_instance", id: "db-1", sharedEnvironmentIds: ["env-1"],
        risk: "medium", impact: "database", componentKey: "api",
        envBindings: [{ sourceKey: "DATABASE_URL", targetEnvKey: "API_DATABASE_URL" }],
      }],
    }, null);

    expect(result.resourceReferences[0]).toMatchObject({
      componentKey: "api",
      envBindings: [{ sourceKey: "DATABASE_URL", targetEnvKey: "API_DATABASE_URL" }],
    });
  });

  it("rejects cross-source environment key collisions when saving", async () => {
    const tx = txWith("resource_instance");
    tx.resourceInstance.findFirst.mockResolvedValue({
      id: "db-1", name: "database", environmentId: "env-1",
      resourceType: { envTemplate: "DATABASE_URL=${url}" },
    });
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      plainVariables: { DATABASE_URL: "must-not-appear-in-error" },
      resourceReferences: [{
        kind: "resource_instance", id: "db-1", sharedEnvironmentIds: ["env-1"],
        risk: "medium", impact: "database", componentKey: "api",
        envBindings: [{ sourceKey: "DATABASE_URL", targetEnvKey: "DATABASE_URL" }],
      }],
    }, null)).rejects.toThrow(
      "环境变量 DATABASE_URL 存在来源冲突",
    );
  });

  it("rejects a new resource reference without component and explicit mappings", async () => {
    const tx = txWith("resource_instance");
    tx.resourceInstance.findFirst.mockResolvedValue({
      id: "db-1", name: "database", environmentId: "env-1",
      resourceType: { envTemplate: "DATABASE_URL=${url}" },
    });
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "resource_instance", id: "db-1", sharedEnvironmentIds: ["env-1"],
        risk: "medium", impact: "legacy database",
      }],
    }, null)).rejects.toThrow("必须指定目标组件");
  });
  it("rejects a managed resource reference from another project or team (cross-project)", async () => {
    const tx = txWith("managed_resource");
    tx.managedResource.findFirst.mockResolvedValue(null);
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "managed_resource", id: "foreign-resource",
        sharedEnvironmentIds: ["env-1"], risk: "medium", impact: "staging",
        componentKey: "api", envBindings: [],
      }],
    }, null)).rejects.toThrow("无效或跨项目");
  });

  it("rejects a resource instance reference from another project or team (cross-project)", async () => {
    const tx = txWith("resource_instance");
    tx.resourceInstance.findFirst.mockResolvedValue(null);
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "resource_instance", id: "foreign-instance",
        sharedEnvironmentIds: ["env-1"], risk: "medium", impact: "staging",
        componentKey: "api", envBindings: [],
      }],
    }, null)).rejects.toThrow("无效或跨项目");
  });

  it("rejects a shared scope that names an environment outside the project/team", async () => {
    const tx = txWith("managed_resource");
    tx.managedResource.findFirst.mockResolvedValue({ id: "resource-1", name: "pg", environmentId: "env-1" });
    tx.projectEnvironment.findMany.mockResolvedValue([{ id: "env-1" }]);
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1", "foreign-env"], risk: "medium", impact: "shared",
        componentKey: "api", envBindings: [],
      }],
    }, null)).rejects.toThrow("共享环境 引用无效或越权");
  });

  it("rejects a shared scope that omits the current environment", async () => {
    const tx = txWith("managed_resource");
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-2"], risk: "medium", impact: "shared",
        componentKey: "api", envBindings: [],
      }],
    }, null)).rejects.toThrow("共享环境必须包含当前环境");
  });

  it("rejects a resource whose owning environment lies outside the shared scope", async () => {
    const tx = txWith("managed_resource");
    tx.managedResource.findFirst.mockResolvedValue({ id: "resource-1", name: "pg", environmentId: "env-2" });
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1"], risk: "medium", impact: "staging only",
        componentKey: "api", envBindings: [],
      }],
    }, null)).rejects.toThrow("所属环境未包含在共享范围");
  });

  it("rejects low-risk declarations shared across environments", async () => {
    const tx = txWith("managed_resource");
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope(), {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1", "env-2"], risk: "low", impact: "shared",
        componentKey: "api", envBindings: [],
      }],
    }, null)).rejects.toThrow("风险不能为 low");
  });

  it("AC-SET-026 production anti-share: rejects a production reference shared with non-production", async () => {
    const tx = txWith("managed_resource");
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, scope({ baselineRole: "production" }), {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1", "env-2"], risk: "high", impact: "prod",
        componentKey: "api", envBindings: [],
      }],
    }, null)).rejects.toThrow("禁止与非生产环境共享");
  });

  it("AC-SET-026 production anti-share: a dedicated production reference is allowed", async () => {
    const tx = txWith("managed_resource");
    tx.managedResource.findFirst.mockResolvedValue({ id: "resource-1", name: "redis-prod", environmentId: "env-1" });
    const resolver = new EnvironmentConfigReferenceResolverService();
    const result = await resolver.resolve(tx as never, scope({ baselineRole: "production" }), {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1"], risk: "high", impact: "prod only",
        componentKey: "api", envBindings: [],
      }],
    }, null);
    expect(result.resourceReferences).toHaveLength(1);
    expect(result.resourceReferences[0]).toMatchObject({ id: "resource-1", name: "redis-prod" });
  });

  it("AC-SET-026 allows non-production sharing with explicit medium risk", async () => {
    const tx = txWith("managed_resource");
    tx.managedResource.findFirst.mockResolvedValue({ id: "resource-1", name: "pg-shared", environmentId: "env-1" });
    const resolver = new EnvironmentConfigReferenceResolverService();
    const result = await resolver.resolve(tx as never, scope({ baselineRole: "staging" }), {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1", "env-2"], risk: "medium", impact: "shared",
        componentKey: "api", envBindings: [],
      }],
    }, null);
    expect(result.resourceReferences[0]).toMatchObject({
      id: "resource-1", sharedEnvironmentIds: ["env-1", "env-2"],
    });
  });
});
