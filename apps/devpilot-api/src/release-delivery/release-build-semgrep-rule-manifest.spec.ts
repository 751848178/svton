import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";

const MANIFEST_SHA = "cd087178050a0abf3664375e5c9a7f4bbc0810c59fa53771d44fd6467662c648";
const RULE_SET_SHA = "67ebc323d193c658fa86ff175823e4aceee40bd822d5b34f1c1928cf8780a678";

describe("server-owned Semgrep rule manifest", () => {
  const root = process.cwd();
  const manifest = readFileSync(join(root, "security/semgrep-rule-manifest.txt"), "utf8");
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
  const profile = resolveRegisteredReleaseBuildProfile("controlled-local-acceptance-v2")!;
  const sast = profile.scanners.find(({ id }) => id === "sast")!;

  it("binds the pinned archive to an explicit unique rule-subpath allowlist", () => {
    expect(createHash("sha256").update(manifest).digest("hex")).toBe(MANIFEST_SHA);
    expect(manifest).toContain("archiveCommit 40b8c63f75dc7c22c8a77482d73bfb864b146f7e");
    expect(manifest).toContain("archiveSha256 b7e483abf001c405a3e908251ff66cb198a26702aff5fe4c5f0c4b2fffec4919");
    expect(manifest).toContain("selectedRuleCount 2075");
    expect(manifest).toContain("selectedRulesSha256 67ebc323d193c658fa86ff175823e4aceee40bd822d5b34f1c1928cf8780a678");
    const paths = manifest.split("\n").filter((line) => line.startsWith("path "));
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining([
      "path generic", "path javascript", "path python", "path terraform",
      "path typescript", "path yaml",
    ]));
    expect(manifest).not.toMatch(/\.pre-commit|path stats|path scripts/);
  });

  it("freezes the sanitized config path in profile, supply proof and image proof", () => {
    expect(profile).toMatchObject({ profileVersion: 4,
      runnerVersion: "release-build-runner-v4" });
    const paths = manifest.split("\n")
      .filter((line) => line.startsWith("path "))
      .map((line) => line.slice("path ".length));
    const configs = sast.argvTemplate.flatMap((value, index, argv) =>
      argv[index - 1] === "--config" ? [value] : []);
    expect(configs).toEqual(paths.map((path) =>
      `/opt/devpilot/security/semgrep-rules-manifest/${path}`));
    expect(configs.every((path) => !path.endsWith("semgrep-rules-manifest")))
      .toBe(true);
    expect(sast.rulesDigest).toBe(RULE_SET_SHA);
    expect(profile.supplyChain.artifactDigests.semgrepRuleManifest)
      .toBe(`sha256:${MANIFEST_SHA}`);
    expect(expectedReleaseBuildSupplyProof(profile).supplyChainDigest)
      .toMatch(/^[a-f0-9]{64}$/);
    expect(dockerfile).toContain(`${MANIFEST_SHA}  /tmp/semgrep-rule-manifest.txt`);
    expect(dockerfile).toContain("/out/semgrep-rules-manifest/");
    expect(dockerfile).toContain("while read -r rule_path; do");
    expect(dockerfile).toContain('semgrep scan --config "/opt/devpilot/security/semgrep-rules-manifest/$rule_path"');
    expect(dockerfile.match(/\|\| exit 1;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(dockerfile).not.toContain("--exclude-error");
  });
});
