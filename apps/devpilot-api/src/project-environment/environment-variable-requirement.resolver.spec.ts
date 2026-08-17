import {
  resolveEnvironmentVariableRequirements,
  unresolvedEnvironmentVariableRequirements,
} from "./environment-variable-requirement.resolver";

describe("environment variable requirement resolver", () => {
  const requirements = resolveEnvironmentVariableRequirements([{
    id: "service-1",
    releaseComponentKey: "api",
    metadata: { repositoryAnalysis: { environment: [
      { name: "API_URL", required: true, secret: false },
      { name: "DATABASE_URL", required: true, secret: false },
      { name: "JWT_SECRET", required: true, secret: true },
      { name: "OPTIONAL", required: false, secret: false },
      { name: "bad-key", required: true, secret: false, value: "must-not-leak" },
    ] } },
  }]);

  it("reads only safe required declarations from service metadata", () => {
    expect(requirements.map((item) => [item.key, item.secret])).toEqual([
      ["API_URL", false],
      ["DATABASE_URL", false],
      ["JWT_SECRET", true],
    ]);
    expect(JSON.stringify(requirements)).not.toContain("must-not-leak");
  });

  it("requires non-empty plain/resource owners and exact secret target keys", () => {
    expect(unresolvedEnvironmentVariableRequirements({
      requirements,
      plainVariables: { API_URL: "", DATABASE_URL: "db://host" },
      resourceReferences: [{
        componentKey: "api",
        envBindings: [{ sourceKey: "url", targetEnvKey: "API_URL" }],
      }],
      secretReferences: [{ id: "secret-1", targetEnvKey: "JWT_SECRET" }],
    })).toEqual([]);
    expect(unresolvedEnvironmentVariableRequirements({
      requirements,
      plainVariables: { API_URL: "" },
      resourceReferences: [],
      secretReferences: [{ id: "secret-1", targetEnvKey: "OTHER_SECRET" }],
    }).map((item) => item.key)).toEqual([
      "API_URL",
      "DATABASE_URL",
      "JWT_SECRET",
    ]);
  });

  it("does not satisfy a component requirement with another component resource", () => {
    const unresolved = unresolvedEnvironmentVariableRequirements({
      requirements,
      plainVariables: { DATABASE_URL: "db://host" },
      resourceReferences: [{
        componentKey: "web",
        envBindings: [{ sourceKey: "url", targetEnvKey: "API_URL" }],
      }],
      secretReferences: [{ targetEnvKey: "JWT_SECRET" }],
    });
    expect(unresolved.map((item) => item.key)).toEqual(["API_URL"]);
  });
});
