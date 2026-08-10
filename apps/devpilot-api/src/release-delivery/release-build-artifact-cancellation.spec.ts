import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";

describe("ReleaseBuildArtifactService cancellation", () => {
  let scope: string;

  afterEach(async () => {
    if (scope) await rm(scope, { recursive: true, force: true });
  });

  it("aborts active archive streaming and removes partial outputs", async () => {
    scope = await mkdtemp(join(tmpdir(), "f426-artifact-cancel-"));
    const checkout = join(scope, "checkout");
    const artifacts = join(scope, "artifacts");
    await mkdir(checkout, { recursive: true });
    await writeFile(
      join(checkout, "payload.bin"),
      randomBytes(32 * 1024 * 1024),
    );
    const service = new ReleaseBuildArtifactService(
      config({ RELEASE_BUILD_ARTIFACT_ROOT: artifacts }),
    );
    const controller = new AbortController();
    const reason = new Error("F426 packaging deadline");
    const packaging = service.package(
      {
        checkoutRoot: checkout,
        projectId: "project-1",
        releaseOrderId: "order-1",
        buildRunId: "run-1",
        components: [
          {
            key: "service-1",
            name: "api",
            workingDirectory: ".",
            buildCommand: "true",
            artifactOutputs: ["payload.bin"],
            buildEnvironment: {},
          },
        ],
      },
      controller.signal,
    );
    setTimeout(() => controller.abort(reason), 10);
    await expect(packaging).rejects.toBe(reason);
    const target = join(artifacts, "project-1", "order-1", "run-1");
    await expect(access(target)).rejects.toThrow();
  });
});

function config(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
