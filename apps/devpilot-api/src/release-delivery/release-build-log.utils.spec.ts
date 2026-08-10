import {
  buildLogSummary,
  presentBuildLogSummary,
  sanitizeBuildLogs,
} from "./release-build-log.utils";

describe("release build log contract", () => {
  it("redacts multiline private keys and structured secret assignments", () => {
    const lines = sanitizeBuildLogs([
      [
        "before",
        "-----BEGIN PRIVATE KEY-----",
        "sentinel-private-material",
        "-----END PRIVATE KEY-----",
        'clientSecret: "sentinel-secret"',
        "after",
      ].join("\n"),
    ]);
    expect(lines.join("\n")).toContain("[REDACTED_PRIVATE_KEY]");
    expect(lines.join("\n")).toContain("clientSecret: [REDACTED]");
    expect(lines.join("\n")).not.toContain("sentinel-private-material");
    expect(lines.join("\n")).not.toContain("sentinel-secret");
  });

  it("redacts YAML block scalars and structured secret arrays", () => {
    const lines = sanitizeBuildLogs([
      [
        "clientSecret: |",
        "  sentinel-block-secret",
        'apiKeys: ["sentinel-array-secret", "other"]',
        "passwords:",
        "  - sentinel-list-secret",
        "apiTokens:",
        "- sentinel-indentless-secret",
        "safe: visible",
      ].join("\n"),
    ]);
    expect(lines).toContain("clientSecret: [REDACTED]");
    expect(lines).toContain("apiKeys: [REDACTED]");
    expect(lines).toContain("passwords: [REDACTED]");
    expect(lines).toContain("apiTokens: [REDACTED]");
    expect(lines).toContain("safe: visible");
    expect(lines.join("\n")).not.toContain("sentinel-");
  });

  it("pins commands and terminal results while reporting split-line truncation", () => {
    const summary = buildLogSummary([
      "[api] $ pnpm build",
      Array.from({ length: 240 }, (_, index) => `noise-${index}`).join("\n"),
      "result succeeded: artifact sha256:abc",
    ]);
    expect(summary).toMatchObject({
      redacted: true,
      truncated: true,
      sourceLineCount: 242,
      lineCount: 200,
    });
    expect(summary.lines[0]).toBe("[api] $ pnpm build");
    expect(summary.lines.at(-1)).toBe("result succeeded: artifact sha256:abc");
  });

  it("rejects unredacted stored summaries and re-sanitizes accepted lines", () => {
    expect(
      presentBuildLogSummary({ redacted: false, lines: ["password=sentinel"] }),
    ).toBeNull();
    expect(
      presentBuildLogSummary({
        redacted: true,
        lines: ["password=sentinel", "result failed"],
      }),
    ).toMatchObject({
      lines: ["password=[REDACTED]", "result failed"],
    });
  });

  it("redacts stored block and PEM secrets split across summary lines", () => {
    const presented = presentBuildLogSummary({
      redacted: true,
      lines: [
        "clientSecret: |",
        "  sentinel-stored-block",
        "-----BEGIN PRIVATE KEY-----",
        "sentinel-stored-pem",
        "-----END PRIVATE KEY-----",
        "result failed",
      ],
    });
    expect(presented).toMatchObject({
      lines: [
        "clientSecret: [REDACTED]",
        "[REDACTED_PRIVATE_KEY]",
        "result failed",
      ],
    });
    expect(presented?.lines.join("\n")).not.toContain("sentinel-stored");
  });
});
