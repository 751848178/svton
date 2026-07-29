import {
  parseOutputSentinel,
  validateOutputShape,
  OutputParseError,
  sanitizeOutputForPersistence,
} from "./release-output.utils";

function b64url(obj: unknown): string {
  const b64 = Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("release-output validateOutputShape", () => {
  it("accepts a well-formed output", () => {
    expect(
      validateOutputShape({
        schemaVersion: 1,
        summary: "ok",
        values: { a: 1 },
        metrics: { m: 2 },
        artifacts: [{ name: "x" }],
      }),
    ).toBeDefined();
  });

  it("rejects non-object", () => {
    expect(() => validateOutputShape("x")).toThrow(OutputParseError);
    expect(() => validateOutputShape([])).toThrow(OutputParseError);
  });

  it("rejects wrong schemaVersion", () => {
    expect(() =>
      validateOutputShape({ schemaVersion: 2 }),
    ).toThrow(OutputParseError);
  });

  it("rejects unknown top-level key", () => {
    expect(() =>
      validateOutputShape({ schemaVersion: 1, evil: "x" }),
    ).toThrow(OutputParseError);
  });

  it("rejects non-numeric metric", () => {
    expect(() =>
      validateOutputShape({ schemaVersion: 1, metrics: { m: "x" } }),
    ).toThrow(OutputParseError);
  });

  it("rejects artifact without name", () => {
    expect(() =>
      validateOutputShape({ schemaVersion: 1, artifacts: [{ kind: "x" }] }),
    ).toThrow(OutputParseError);
  });
});

describe("release-output parseOutputSentinel", () => {
  it("returns null when no sentinel present and redacts text", () => {
    const r = parseOutputSentinel("password=hunter2 plain line");
    expect(r.output).toBeNull();
    expect(r.cleanedText).toContain("[REDACTED]");
    expect(r.cleanedText).not.toContain("hunter2");
  });

  it("parses a valid sentinel payload", () => {
    const payload = b64url({
      schemaVersion: 1,
      summary: "ok",
      values: { count: 3 },
    });
    const text = `some log\n@@DEVPILOT_OUTPUT@@ ${payload}\nmore log`;
    const r = parseOutputSentinel(text);
    expect(r.output).not.toBeNull();
    expect(r.output?.values?.count).toBe(3);
    // 哨兵行被替换为摘要
    expect(r.cleanedText).toContain("[已解析结构化输出]");
    expect(r.cleanedText).not.toContain(payload);
  });

  it("rejects malformed payload without throwing outside sentinel", () => {
    const text = `@@DEVPILOT_OUTPUT@@ !!!notbase64`;
    expect(() => parseOutputSentinel(text)).toThrow(OutputParseError);
  });

  it("only consumes first sentinel", () => {
    const p1 = b64url({ schemaVersion: 1, summary: "first" });
    const p2 = b64url({ schemaVersion: 1, summary: "second" });
    const text = `@@DEVPILOT_OUTPUT@@ ${p1}\n@@DEVPILOT_OUTPUT@@ ${p2}`;
    const r = parseOutputSentinel(text);
    expect(r.output?.summary).toBe("first");
  });
});

describe("release-output sanitizeOutputForPersistence", () => {
  it("redacts secret-looking string values", () => {
    const sanitized = sanitizeOutputForPersistence({
      schemaVersion: 1,
      summary: "token=abc123",
      values: { password: "hunter2", count: 5, nested: { secret: "x" } },
    });
    expect(sanitized?.values?.password).toBe("[REDACTED]");
    expect(sanitized?.values?.count).toBe(5);
    expect((sanitized?.values?.nested as { secret: string }).secret).toBe(
      "[REDACTED]",
    );
    expect(sanitized?.summary).not.toContain("abc123");
  });

  // F383 D10/invest-2 §E.4: artifacts 内嵌连接串密码必须脱敏。
  it("redacts secret values inside artifacts", () => {
    const sanitized = sanitizeOutputForPersistence({
      schemaVersion: 1,
      artifacts: [
        {
          name: "mysql-image",
          ref: "mysql://user:pass@registry.example.com/db",
        },
        { name: "clean-artifact", ref: "registry.example.com/app:tag" },
      ],
    });
    expect(
      (sanitized?.artifacts?.[0] as { ref?: string }).ref,
    ).not.toContain("pass");
    expect(
      (sanitized?.artifacts?.[0] as { ref?: string }).ref,
    ).toContain("[REDACTED]");
    expect((sanitized?.artifacts?.[1] as { ref?: string }).ref).toBe(
      "registry.example.com/app:tag",
    );
    // name 不被脱敏（不是敏感词）
    expect((sanitized?.artifacts?.[0] as { name?: string }).name).toBe(
      "mysql-image",
    );
  });

  it("leaves artifacts as-is when not an array", () => {
    const sanitized = sanitizeOutputForPersistence({
      schemaVersion: 1,
      artifacts: undefined,
    });
    expect(sanitized?.artifacts).toBeUndefined();
  });
});

describe("release-output decoded payload size cap", () => {
  // F383 D10/invest-2 §E.5: 超过 64KiB 的解码负载必须被拒绝。decodePayload 的
  // token 长度早退检查 + 解码后字节检查两层都会抛 OutputParseError，对合法 base64
  // 而言 token 长度永远 >= 解码字节，故此处通过哨兵驱动的解码路径断言拒绝行为。
  it("throws OutputParseError when payload exceeds 64KiB", () => {
    const big = "x".repeat(70 * 1024);
    const payload = b64url({ schemaVersion: 1, values: { value: big } });
    const text = `@@DEVPILOT_OUTPUT@@ ${payload}`;
    expect(() => parseOutputSentinel(text)).toThrow(OutputParseError);
    expect(() => parseOutputSentinel(text)).toThrow(/超过.*字节上限/);
  });

  it("accepts a payload comfortably under both token and decoded caps", () => {
    // base64 token ≈ 4/3 * JSON 字节，故 JSON 必须 < 48KB 才能让 token 也 < 64KiB。
    const big = "y".repeat(40 * 1024);
    const payload = b64url({
      schemaVersion: 1,
      summary: "ok",
      values: { value: big },
    });
    const text = `@@DEVPILOT_OUTPUT@@ ${payload}`;
    const r = parseOutputSentinel(text);
    expect(r.output?.values?.value).toHaveLength(40 * 1024);
  });
});
