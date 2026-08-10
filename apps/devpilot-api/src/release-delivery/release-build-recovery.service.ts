import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { mkdir, readdir, realpath, rm } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { ReleaseBuildRecoveryRepository } from "./release-build-recovery.repository";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";

@Injectable()
export class ReleaseBuildRecoveryService implements OnApplicationBootstrap {
  constructor(
    private readonly runtime: ReleaseBuildRuntimeProfileService,
    private readonly recovery: ReleaseBuildRecoveryRepository,
  ) {}

  async onApplicationBootstrap() {
    if (!this.runtime.activationRequested) return;
    this.runtime.assertAvailable();
    await mkdir(this.runtime.workRoot, { recursive: true, mode: 0o700 });
    await mkdir(this.runtime.artifactRoot, { recursive: true, mode: 0o700 });
    const root = await realpath(this.runtime.workRoot);
    const artifactRoot = await realpath(this.runtime.artifactRoot);
    assertIsolatedRoots(root, artifactRoot);
    await this.recovery.recoverInterrupted();
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        (entry.name === "runtime" ||
          entry.name.startsWith("devpilot-release-build-"))
      ) {
        await rm(join(root, entry.name), { recursive: true, force: true });
      }
    }
    await mkdir(join(root, "runtime"), { recursive: true, mode: 0o700 });
  }
}

function assertIsolatedRoots(workRoot: string, artifactRoot: string) {
  assertOutsideApplication(workRoot);
  assertOutsideApplication(artifactRoot);
  if (contains(workRoot, artifactRoot) || contains(artifactRoot, workRoot)) {
    throw new Error("Release build work and artifact roots overlap");
  }
}

function assertOutsideApplication(root: string) {
  const application = process.cwd();
  const fromRoot = relative(root, application);
  const fromApplication = relative(application, root);
  if (
    fromRoot === "" ||
    fromApplication === "" ||
    (!fromRoot.startsWith("..") && !isAbsolute(fromRoot)) ||
    (!fromApplication.startsWith("..") && !isAbsolute(fromApplication))
  ) {
    throw new Error(
      "Release build work root overlaps the application directory",
    );
  }
}

function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}
