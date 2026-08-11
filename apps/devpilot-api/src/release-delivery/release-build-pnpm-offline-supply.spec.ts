import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { lockedInstallArgs } from "./release-build-package-policy";

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
    expect(dockerfile).toContain("RUN --network=none export CI=true");
    expect(dockerfile).toContain('"$PNPM_EXECUTABLE" install --offline --frozen-lockfile');
    expect(dockerfile).toContain("--dir=/tmp/pnpm-offline-proof");
    expect(dockerfile).toContain('fetch --frozen-lockfile --ignore-scripts');
    expect(dockerfile).toContain("node_modules/is-number/package.json");
    expect(dockerfile).toContain("test ! -e /tmp/pnpm-offline-proof/preinstall-ran");
    expect(dockerfile).toContain(
      "cp /tmp/dependency-public-fixture/package.json \\",
    );
    expect(dockerfile).toContain(
      "/tmp/dependency-public-fixture/pnpm-lock.yaml \\",
    );
    expect(dockerfile).toContain(
      "test ! -e /tmp/pnpm-offline-proof/node_modules",
    );
    expect(dockerfile).not.toContain(
      "cp -R /tmp/dependency-public-fixture/. /tmp/pnpm-offline-proof/",
    );
    expect(dockerfile).not.toContain("install --force");
  });

  it("uses the same mounted store for dependency install and rebuild", () => {
    const storeMount = "--mount=type=cache,id=pnpm-store,target=/pnpm/store";
    expect(dockerfile.match(new RegExp(storeMount, "g"))).toHaveLength(2);
    expect(dockerfile).toContain(
      'install --frozen-lockfile --store-dir=/pnpm/store --ignore-scripts',
    );
    expect(dockerfile).toContain(
      'rebuild --store-dir=/pnpm/store',
    );
  });

  it("forces build jobs to use the private offline store without lifecycle scripts", () => {
    expect(lockedInstallArgs("pnpm", "/work/dependency-store")).toEqual([
      "install", "--frozen-lockfile", "--offline", "--ignore-scripts",
      "--store-dir=/work/dependency-store/store",
    ]);
  });
});
