import { ConfigService } from "@nestjs/config";
import { lstat, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalReleaseEvidenceArtifactService } from "./local-release-evidence-artifact.service";

describe("LocalReleaseEvidenceArtifactService", () => {
  let scope: string;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-evidence-spec-"));
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("publishes an immutable mode-0600 digest-addressed report", async () => {
    const service = create(scope);
    const input = {
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      category: "secretScan",
      report: { version: 1, findings: [] },
    };
    const first = await service.publish(input);
    const replay = await service.publish(input);
    expect(replay).toEqual(first);
    const path = join(
      scope,
      "evidence/project-1/order-1/build-1",
      first.evidenceRef.split("/").at(-1)!,
    );
    expect((await lstat(path)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(input.report);
  });

  it("rejects a symlink path that escapes the configured root", async () => {
    const outside = await mkdtemp(join(tmpdir(), "release-evidence-outside-"));
    await symlink(outside, join(scope, "evidence"));
    await expect(
      create(scope).publish({
        projectId: "project-1",
        releaseOrderId: "order-1",
        buildRunId: "build-1",
        category: "sast",
        report: {},
      }),
    ).rejects.toThrow("escapes configured root");
    await rm(outside, { recursive: true, force: true });
  });
});

function create(root: string) {
  return new LocalReleaseEvidenceArtifactService(
    new ConfigService({ RELEASE_BUILD_ARTIFACT_ROOT: root }),
  );
}
