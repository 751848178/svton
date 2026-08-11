import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";

const MANIFEST_SHA = "50f2b21179f82f6c7248122df5a141974c14c3657965cfe9d7465eb0841179ae";
const RULE_SET_SHA = "fd7c589911672528ba190da81f9d0777343bb5c2c8678e8810268afa5d97aca3";

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
    expect(manifest).toContain("selectedRuleCount 2050");
    expect(manifest).toContain(`selectedRulesSha256 ${RULE_SET_SHA}`);
    const paths = manifest.split("\n").filter((line) => line.startsWith("path "));
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining([
      "path generic", "path javascript", "path python", "path terraform",
      "path typescript", "path yaml",
    ]));
    expect(paths).toHaveLength(26);
    expect(manifest).not.toMatch(/\.pre-commit|path apex|path elixir|path stats|path scripts/);
  });

  it("freezes the sanitized config path in profile, supply proof and image proof", () => {
    expect(profile).toMatchObject({ profileVersion: 6,
      runnerVersion: "release-build-runner-v6",
      sastCapability: {
        engine: "semgrep-oss-1.172.0",
        unsupportedExtensions: [".cls", ".trigger", ".ex", ".exs"],
      },
    });
    const paths = manifest.split("\n")
      .filter((line) => line.startsWith("path "))
      .map((line) => line.slice("path ".length));
    const configs = sast.argvTemplate.flatMap((value, index, argv) =>
      argv[index - 1] === "--config" ? [value] : []);
    expect(configs).toEqual(paths.map((path) =>
      `/opt/devpilot/security/semgrep-rules-manifest/${path}`));
    expect(profile.sastCapability.rulePaths).toEqual(paths);
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
