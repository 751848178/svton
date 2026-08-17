import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import {
  expectedReleaseBuildSupplyProof,
  verifyReleaseBuildSupplyProof,
} from "./release-build-supply-proof.policy";

describe("release build supply proof", () => {
  const profile = resolveRegisteredReleaseBuildProfile(
    "controlled-local-acceptance-v2",
  )!;
  let root: string;

  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "supply-proof-")); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("accepts only the canonical registered immutable digest", () => {
    const path = join(root, "proof.json");
    writeFileSync(path, JSON.stringify(expectedReleaseBuildSupplyProof(profile)), {
      mode: 0o440,
    });
    expect(verifyReleaseBuildSupplyProof(path, profile)).toBe(true);
    chmodSync(path, 0o600);
    writeFileSync(path, JSON.stringify({
      ...expectedReleaseBuildSupplyProof(profile), supplyChainDigest: "tampered",
    }));
    expect(verifyReleaseBuildSupplyProof(path, profile)).toBe(false);
  });

  it("rejects symlink and group-writable proof files", () => {
    const target = join(root, "target.json");
    const link = join(root, "proof.json");
    writeFileSync(target, JSON.stringify(expectedReleaseBuildSupplyProof(profile)));
    symlinkSync(target, link);
    expect(verifyReleaseBuildSupplyProof(link, profile)).toBe(false);
    chmodSync(target, 0o660);
    expect(verifyReleaseBuildSupplyProof(target, profile)).toBe(false);
  });

  it("binds the exact SAST capability into the supply digest", () => {
    const changed = {
      ...profile,
      sastCapability: {
        ...profile.sastCapability,
        unsupportedExtensions: [...profile.sastCapability.unsupportedExtensions, ".new"],
      },
    };
    expect(expectedReleaseBuildSupplyProof(changed).supplyChainDigest)
      .not.toBe(expectedReleaseBuildSupplyProof(profile).supplyChainDigest);
  });
});
