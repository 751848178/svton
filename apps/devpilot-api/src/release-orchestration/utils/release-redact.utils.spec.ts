import {
  isLikelySecretKey,
  redactSecretsInText,
  redactSecretsInObject,
  stripSecretEnvFromSteps,
} from "./release-redact.utils";

describe("release-redact isLikelySecretKey", () => {
  it.each(["password", "DB_PASSWORD", "api_key", "clientSecret", "authToken", "privateKey"])(
    "flags %s",
    (k) => {
      expect(isLikelySecretKey(k)).toBe(true);
    },
  );
  it.each(["name", "branch", "count", "host", "port"])("does not flag %s", (k) => {
    expect(isLikelySecretKey(k)).toBe(false);
  });
});

describe("release-redact redactSecretsInText", () => {
  it("redacts mysql connection string password", () => {
    const out = redactSecretsInText(
      "mysql://root:hunter2@localhost:3306/db",
    );
    expect(out).not.toContain("hunter2");
    expect(out).toContain("[REDACTED]");
  });

  it("redacts ENV-style secret lines", () => {
    const out = redactSecretsInText("export DATABASE_URL=postgres://u:pw@h/db");
    expect(out).not.toContain("pw@h");
  });

  it("redacts Bearer token", () => {
    const out = redactSecretsInText("Authorization: Bearer abc.def.ghi");
    expect(out).not.toContain("abc.def.ghi");
    expect(out).toContain("Bearer");
  });

  it("redacts PEM private key block", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIBOQIBAA\n-----END RSA PRIVATE KEY-----";
    expect(redactSecretsInText(pem)).toBe("[REDACTED]");
  });

  it("does not touch plain text", () => {
    expect(redactSecretsInText("hello world")).toBe("hello world");
  });
});

describe("release-redact redactSecretsInObject", () => {
  it("redacts values of secret-named keys recursively", () => {
    const out = redactSecretsInObject({
      name: "deploy",
      password: "hunter2",
      nested: { api_key: "k1", count: 3 },
      list: [{ token: "t1" }, { name: "ok" }],
    });
    expect(out).toEqual({
      name: "deploy",
      password: "[REDACTED]",
      nested: { api_key: "[REDACTED]", count: 3 },
      list: [{ token: "[REDACTED]" }, { name: "ok" }],
    });
  });
});

describe("release-redact stripSecretEnvFromSteps", () => {
  it("removes secretEnv field from command steps", () => {
    const steps = [
      { command: "echo", secretEnv: { PWD: "x" } },
      { command: "ls" },
    ] as never;
    const out = stripSecretEnvFromSteps(steps);
    expect((out[0] as { secretEnv?: unknown }).secretEnv).toBeUndefined();
    expect((out[0] as { command: string }).command).toBe("echo");
  });
});
