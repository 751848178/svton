import "reflect-metadata";
import type { ReleaseBuildHttpRuntimeFixture } from "./release-build-http-runtime.fixture";

const describeRuntime =
  process.env.RUN_F428_HTTP_RUNTIME === "1" ? describe : describe.skip;

jest.setTimeout(30_000);

describeRuntime("F428 authenticated HTTP Build history runtime", () => {
  let fixture: ReleaseBuildHttpRuntimeFixture;

  beforeAll(async () => {
    const { ReleaseBuildHttpRuntimeFixture } =
      await import("./release-build-http-runtime.fixture");
    fixture = new ReleaseBuildHttpRuntimeFixture();
    await fixture.start();
  });
  afterAll(() => fixture?.stop());

  it("keeps repeated build evidence distinct and returns only redacted logs", async () => {
    await fixture.configureBuild({
      workingDirectory: ".",
      buildCommand:
        "node -e \"const fs=require('fs');console.log(Buffer.from('YXV0aG9yaXphdGlvbjogQmVhcmVyIHNlY3JldC12YWx1ZQpBUElfVE9LRU49dG9wc2VjcmV0','base64').toString());fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/app.js','ok')\"",
      artifactPaths: ["dist"],
    });
    const first = await runBuild(fixture);
    const second = await runBuild(fixture);

    expect(second.id).not.toBe(first.id);
    expect(second.manifest.id).not.toBe(first.manifest.id);
    expect(second.manifest.digest).toBe(first.manifest.digest);

    const listResponse = await fixture.request(fixture.buildsPath());
    expect(listResponse.ok).toBe(true);
    expect(listResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(listResponse.headers.get("vary")).toContain("Authorization");
    const list = (await listResponse.json()) as { data: { items: Build[] } };
    const rows = list.data.items.filter(({ id }) =>
      [first.id, second.id].includes(id),
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.logReference).toBeNull();
      expect(row.logSummary).toBeNull();
      expect(row.manifest.items).toEqual([]);
      const detailResponse = await fixture.request(
        `${fixture.buildsPath()}/${row.id}`,
      );
      expect(detailResponse.ok).toBe(true);
      expect(detailResponse.headers.get("cache-control")).toBe(
        "private, no-store",
      );
      expect(detailResponse.headers.get("vary")).toContain("X-Team-Id");
      const detail = (await detailResponse.json()) as { data: Build };
      expect(detail.data.logReference).toBe(`build-log://${row.id}`);
      const summary = detail.data.logSummary;
      expect(summary).not.toBeNull();
      if (!summary) throw new Error("Exact BuildRun detail omitted its logs");
      expect(summary.redacted).toBe(true);
      expect(summary.lines).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\[[^\]]+\] \$ /),
          expect.stringMatching(/^result succeeded:/),
        ]),
      );
      expect(summary.lines.join("\n")).not.toMatch(/secret-value|topsecret/);
    }
  });
});

async function runBuild(fixture: ReleaseBuildHttpRuntimeFixture) {
  const response = await fixture.request(fixture.buildsPath(), {
    method: "POST",
  });
  expect(response.ok).toBe(true);
  const body = (await response.json()) as { data: Build };
  if (body.data.status !== "succeeded") {
    throw new Error(`HTTP Build failed: ${JSON.stringify(body.data)}`);
  }
  return body.data;
}

interface Build {
  id: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  logReference: string | null;
  logSummary: { redacted: boolean; lines: string[] } | null;
  manifest: { id: string; digest: string; items: unknown[] };
}
