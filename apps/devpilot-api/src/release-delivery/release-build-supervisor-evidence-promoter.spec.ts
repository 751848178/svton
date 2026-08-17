import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promoteSupervisorEvidence } from "./release-build-supervisor-evidence-promoter";

describe("supervisor evidence promotion", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "supervisor-evidence-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("atomically preserves canonical evidence for a blocked scan", async () => {
    const trustedRoot = join(root, "trusted");
    const outputRoot = join(root, "output");
    const leaf = join(trustedRoot, "artifacts", "evidence", "project-1", "order-1", "build-1");
    await mkdir(leaf, { recursive: true });
    const report = Buffer.from(JSON.stringify({ identity: { buildRunId: "build-1" },
      result: { status: "failed", findings: 1 } }));
    const digest = createHash("sha256").update(report).digest("hex");
    const name = `sast-${digest}.json`;
    await writeFile(join(leaf, name), report);

    await expect(promoteSupervisorEvidence({ trustedRoot, outputRoot,
      projectId: "project-1", releaseOrderId: "order-1", buildRunId: "build-1" }))
      .resolves.toBe(1);
    await expect(Promise.all([1, 2].map(() => promoteSupervisorEvidence({
      trustedRoot, outputRoot, projectId: "project-1",
      releaseOrderId: "order-1", buildRunId: "build-1",
    })))).resolves.toEqual([1, 1]);
    const target = join(outputRoot, "artifacts", "evidence", "project-1",
      "order-1", "build-1", name);
    expect(await readFile(target)).toEqual(report);
    expect(`release-evidence://build-1/${name}`).toMatch(/^release-evidence:\/\/build-1\//);
    expect(await readdir(join(outputRoot, "artifacts"))).toEqual(["evidence"]);
    expect(JSON.parse((await readFile(target)).toString()).result.status).toBe("failed");
    await expect(promoteSupervisorEvidence({ trustedRoot, outputRoot,
      projectId: "project-1", releaseOrderId: "order-1", buildRunId: "build-1" }))
      .resolves.toBe(1);
    await expect(readdir(join(outputRoot, "artifacts")))
      .resolves.toEqual(["evidence"]);
  });

  it("fails closed on a digest or build identity mismatch", async () => {
    const trustedRoot = join(root, "trusted");
    const leaf = join(trustedRoot, "artifacts", "evidence", "project-1", "order-1", "build-1");
    await mkdir(leaf, { recursive: true });
    await writeFile(join(leaf, `sast-${"a".repeat(64)}.json`),
      JSON.stringify({ identity: { buildRunId: "other" } }));
    await expect(promoteSupervisorEvidence({ trustedRoot, outputRoot: join(root, "output"),
      projectId: "project-1", releaseOrderId: "order-1", buildRunId: "build-1" }))
      .rejects.toThrow("digest");
  });
});
