import {
  environmentVariableCollisionMessage,
  findEnvironmentVariableCollisions,
} from "./environment-variable-ownership.model";

describe("environment variable ownership", () => {
  it("reports only key and source references, never source values", () => {
    const collision = findEnvironmentVariableCollisions([
      { key: "DATABASE_URL", source: "resource", reference: "resource_instance:r1:DATABASE_URL" },
      { key: "DATABASE_URL", source: "plain", reference: "DATABASE_URL" },
    ])[0];

    expect(environmentVariableCollisionMessage(collision)).toBe(
      "环境变量 DATABASE_URL 存在来源冲突（plain:DATABASE_URL, resource:resource_instance:r1:DATABASE_URL）",
    );
    expect(JSON.stringify(collision)).not.toContain("postgres://");
  });
});
