import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";

const runFile = promisify(execFile);

describe("ReleaseBuildArtifactService security contract", () => {
  let scope: string;
  let artifactRoot: string;
  let service: ReleaseBuildArtifactService;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-artifact-contract-"));
    artifactRoot = join(scope, "artifacts");
    const config = {
      get: jest.fn((key: string) =>
        key === "RELEASE_BUILD_ARTIFACT_ROOT" ? artifactRoot : undefined,
      ),
    } as unknown as ConfigService;
    service = new ReleaseBuildArtifactService(config);
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("packages only declared outputs reproducibly across independent checkouts", async () => {
    const first = await checkout("first", "built", "noise-a");
    const second = await checkout("second", "built", "noise-b");
    const one = await service.package(input(first, "run-1"));
    const two = await service.package(input(second, "run-2"));
    expect(one.digest).toBe(two.digest);
    expect(one.items[0].digest).toBe(two.items[0].digest);
    expect(one.contentIndex.map((item) => item.path)).toEqual(["dist/app.js"]);
    expect(one.contentIndex[0].digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    await writeFile(join(second, "dist", "app.js"), "changed");
    const changed = await service.package(input(second, "run-3"));
    expect(changed.digest).not.toBe(one.digest);
  });

  it("publishes create-once and can discard an uncommitted artifact", async () => {
    const root = await checkout("publish", "built", "noise");
    const artifact = await service.package(input(root, "run-once"));
    await expect(
      service.package(input(root, "run-once")),
    ).rejects.toMatchObject({
      detail: { code: "ARTIFACT_ALREADY_EXISTS" },
    });
    await expect(
      service.resolveAndVerify({
        projectId: "project-1",
        releaseOrderId: "order-1",
        buildRunId: "run-once",
        uri: artifact.uri,
        digest: artifact.digest,
      }),
    ).resolves.toMatchObject({ sizeBytes: artifact.sizeBytes });
    await service.discard({
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "run-once",
    });
    await expect(
      access(join(artifactRoot, "project-1", "order-1", "run-once")),
    ).rejects.toBeDefined();
  });

  it("rejects ambiguous component ownership for the same output file", async () => {
    const root = await checkout("overlap", "built", "noise");
    const request = input(root, "run-overlap");
    request.components.push({
      ...request.components[0],
      key: "service-2",
      name: "worker",
    });
    await expect(service.package(request)).rejects.toMatchObject({
      detail: { code: "ARTIFACT_OUTPUT_OVERLAP" },
    });
  });

  it("rejects sensitive names, secret content, symlinks, and special files", async () => {
    const root = await checkout("unsafe", "built", "noise");
    await writeFile(join(root, "dist", ".env.production"), "SAFE=value");
    await expect(service.package(input(root, "run-env"))).rejects.toMatchObject(
      {
        detail: { code: "ARTIFACT_SECRET_FILE" },
      },
    );
    await rm(join(root, "dist", ".env.production"));

    await writeFile(
      join(root, "dist", "app.js"),
      "Authorization: Bearer ghp_12345678901234567890",
    );
    await expect(
      service.package(input(root, "run-secret")),
    ).rejects.toMatchObject({
      detail: { code: "ARTIFACT_SECRET_CONTENT" },
    });
    await writeFile(join(root, "dist", "app.js"), "built");

    await writeFile(
      join(root, "dist", "config.json"),
      JSON.stringify({ password: "sentinel-credential" }),
    );
    await expect(
      service.package(input(root, "run-structured-secret")),
    ).rejects.toMatchObject({
      detail: { code: "ARTIFACT_SECRET_CONTENT" },
    });
    for (const [index, key] of [
      "accessToken",
      "clientSecret",
      "apiKey",
      "secretKey",
      "credentials",
    ].entries()) {
      await writeFile(
        join(root, "dist", "config.json"),
        JSON.stringify({ [key]: "sentinel-credential" }),
      );
      await expect(
        service.package(input(root, `run-structured-variant-${index}`)),
      ).rejects.toMatchObject({
        detail: { code: "ARTIFACT_SECRET_CONTENT" },
      });
    }
    await rm(join(root, "dist", "config.json"));

    await symlink("../noise.txt", join(root, "dist", "escape"));
    await expect(
      service.package(input(root, "run-link")),
    ).rejects.toMatchObject({
      detail: { code: "ARTIFACT_UNSAFE_ENTRY" },
    });
    await rm(join(root, "dist", "escape"));

    await runFile("mkfifo", [join(root, "dist", "pipe")]);
    await expect(
      service.package(input(root, "run-fifo")),
    ).rejects.toMatchObject({
      detail: { code: "ARTIFACT_UNSAFE_ENTRY" },
    });
    await rm(join(root, "dist", "pipe"));

    await mkdir(join(root, "dist", "tmp"));
    await writeFile(join(root, "dist", "tmp", "cache.bin"), "cached");
    await expect(
      service.package(input(root, "run-temp")),
    ).rejects.toMatchObject({
      detail: { code: "ARTIFACT_UNSAFE_ENTRY" },
    });
  });

  async function checkout(name: string, output: string, noise: string) {
    const root = join(scope, name);
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(join(root, "dist", "app.js"), output);
    await writeFile(join(root, "noise.txt"), noise);
    return root;
  }
});

function input(checkoutRoot: string, buildRunId: string) {
  return {
    checkoutRoot,
    projectId: "project-1",
    releaseOrderId: "order-1",
    buildRunId,
    components: [
      {
        key: "service-1",
        name: "api",
        workingDirectory: ".",
        buildCommand: "true",
        artifactOutputs: ["dist"],
        buildEnvironment: {},
      },
    ],
  };
}
