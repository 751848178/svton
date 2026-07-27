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

  // F383 D10/invest-3 §D.1: Date 修复——之前落入 object 分支被破坏成 {}。
  it("serializes Date to ISO 8601 string", () => {
    const iso = "2026-07-27T08:13:21.000Z";
    expect(redactSecretsInObject(new Date(iso))).toBe(iso);
  });

  it("serializes Buffer to hex string", () => {
    expect(redactSecretsInObject(Buffer.from("abc"))).toBe("616263");
  });

  it("preserves Date inside nested object while redacting secrets", () => {
    const iso = "2026-07-27T08:13:21.000Z";
    const out = redactSecretsInObject({
      createdAt: new Date(iso),
      password: "x",
      nested: { finishedAt: new Date(iso), token: "t" },
    });
    expect(out).toEqual({
      createdAt: iso,
      password: "[REDACTED]",
      nested: { finishedAt: iso, token: "[REDACTED]" },
    });
  });

  it("array containing Date preserves ISO and still redacts secret keys", () => {
    const iso = "2026-07-27T08:13:21.000Z";
    const out = redactSecretsInObject([
      { startedAt: new Date(iso), apiKey: "k" },
    ]);
    expect(out).toEqual([{ startedAt: iso, apiKey: "[REDACTED]" }]);
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
