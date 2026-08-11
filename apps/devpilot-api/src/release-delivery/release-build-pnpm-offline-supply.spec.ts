import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";

const PNPM_SHA512 = "279278f83be782f6faaefbacbccc503301c4ec2cdafd40983e7c26aeeee7c38270f5c8e635b43464691b897abe1675b40c06df6edadde922532b7368aa9a5267";
const PNPM_EXECUTABLE = "/opt/devpilot/pnpm/8.12.0/bin/pnpm.cjs";

describe("controlled acceptance pnpm supply", () => {
  const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");
  const profile = resolveRegisteredReleaseBuildProfile(
    "controlled-local-acceptance-v2",
  )!;

  it("binds package execution to the verified regular pnpm entity", () => {
    expect(profile.packageManagers.pnpm).toEqual({
      executable: PNPM_EXECUTABLE,
      toolVersion: "8.12.0",
    });
    expect(profile.supplyChain.artifactDigests.pnpmPackage)
      .toBe(`sha512:${PNPM_SHA512}`);
    expect(dockerfile).toContain(`${PNPM_SHA512}  /tmp/pnpm-8.12.0.tgz`);
    expect(dockerfile).toContain(`test ! -L "$PNPM_EXECUTABLE"`);
    expect(dockerfile).not.toContain("corepack prepare");
    expect(dockerfile).not.toContain("corepack enable");
  });

  it("proves UID 3000 can install a frozen fixture without network", () => {
    expect(dockerfile).toContain("USER 3000:3000");
    expect(dockerfile).toContain("ENV HOME=/home");
    expect(dockerfile).toContain("RUN --network=none");
    expect(dockerfile).toContain('"$PNPM_EXECUTABLE" install --offline --frozen-lockfile');
    expect(dockerfile).toContain("--dir=/tmp/pnpm-offline-proof");
  });
});
