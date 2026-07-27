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
});
