import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashReleaseBuildArtifact } from "./release-build-artifact-io";
import { promoteBrokerArtifacts } from "./release-build-broker-artifact-promoter";

describe("broker artifact supervisor promotion", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "broker-promote-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("validates digests and atomically publishes raw and trusted evidence", async () => {
    const fixture = await setup();
    await promoteBrokerArtifacts(fixture.input);
    await expect(readFile(join(fixture.final, "project-1/order-1/build-1/bundle.zip"), "utf8"))
      .resolves.toBe("bundle");
    for (const scanner of ["secrets", "sast", "vulnerability"])
      await expect(readFile(join(fixture.final,
        `evidence/project-1/order-1/build-1/${scanner}.json`), "utf8"))
        .resolves.toBe(scanner);
    await expect(readFile(join(fixture.final,
      "evidence/project-1/order-1/build-1/package.json"), "utf8"))
      .resolves.toBe("package");
    await expect(readFile(join(fixture.final,
      "project-1/order-1/build-1/ArtifactManifest.json"), "utf8"))
      .resolves.toBe("manifest");
  });

  it("is idempotent for retry and concurrent identical publication", async () => {
    const retry = await setup();
    await promoteBrokerArtifacts(retry.input);
    await expect(promoteBrokerArtifacts(retry.input)).resolves.toBeUndefined();

    const concurrent = await setup();
    await expect(Promise.all([
      promoteBrokerArtifacts(concurrent.input),
      promoteBrokerArtifacts(concurrent.input),
    ])).resolves.toEqual([undefined, undefined]);
  });

  it("detects evidence conflict before publishing bundle or manifest", async () => {
    const fixture = await setup();
    const finalEvidence = join(fixture.final, "evidence/project-1/order-1/build-1");
    await mkdir(finalEvidence, { recursive: true });
    await writeFile(join(finalEvidence, "sast.json"), "different");
    await expect(promoteBrokerArtifacts(fixture.input)).rejects
      .toMatchObject({ detail: { code: "ARTIFACT_ALREADY_EXISTS" } });
    await expect(access(join(fixture.final, "project-1/order-1/build-1")))
      .rejects.toBeDefined();
  });

  it("rejects digest drift and symlinks before final publication", async () => {
    const drift = await setup();
    drift.input.result.artifact.digest = "sha256:tampered";
    await expect(promoteBrokerArtifacts(drift.input)).rejects.toThrow("digest mismatch");
    await expect(access(join(drift.final, "project-1/order-1/build-1"))).rejects.toBeDefined();

    const unsafe = await setup();
    await symlink(join(root, "outside"), join(unsafe.raw,
      "project-1/order-1/build-1/unsafe-link"));
    await expect(promoteBrokerArtifacts(unsafe.input)).rejects.toThrow("unsafe entry");
  });

  async function setup() {
    const raw = join(root, `raw-${Math.random()}`);
    const trusted = join(root, `trusted-${Math.random()}`);
    const final = join(root, `final-${Math.random()}`);
    const build = join(raw, "project-1/order-1/build-1");
    const trustedEvidence = join(trusted, "evidence/project-1/order-1/build-1");
    const rawEvidence = join(raw, "evidence/project-1/order-1/build-1");
    await Promise.all([
      mkdir(join(build, "components"), { recursive: true }),
      mkdir(trustedEvidence, { recursive: true }),
      mkdir(rawEvidence, { recursive: true }),
      mkdir(final, { recursive: true }),
    ]);
    const bundle = join(build, "bundle.zip");
    const component = join(build, "components/api.zip");
    await Promise.all([
      writeFile(bundle, "bundle"), writeFile(component, "component"),
      writeFile(join(build, "ArtifactManifest.json"), "manifest"),
      ...["secrets", "sast", "vulnerability"].map((scanner) =>
        writeFile(join(trustedEvidence, `${scanner}.json`), scanner)),
      writeFile(join(rawEvidence, "package.json"), "package"),
    ]);
    const result = {
      artifact: {
        digest: `sha256:${await hashReleaseBuildArtifact(bundle)}`,
        sizeBytes: 6, uri: "release-artifact://build-1/bundle.zip",
        items: [{ componentKey: "api", artifactType: "zip" as const,
          digest: `sha256:${await hashReleaseBuildArtifact(component)}`,
          uri: "release-artifact://build-1/components/api.zip", sizeBytes: 9,
          outputs: ["dist"], contentIndex: [], environment: { mode: "independent" as const } }],
        contentIndex: [],
      }, logs: [], gateSummary: {},
    };
    return { raw, final, input: { rawRoot: raw, trustedRoot: trusted, finalRoot: final,
      projectId: "project-1", releaseOrderId: "order-1", buildRunId: "build-1", result } };
  }
});
