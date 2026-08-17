import { cp, lstat, mkdir, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertReleaseBuildCheckoutRoot } from "./release-build-workspace.policy";

export async function createSeparatedBuildWorkspace(input: {
  workRoot: string;
  sourceRoot: string;
  runtimeRoot: string;
}) {
  const destination = join(input.runtimeRoot, "workspace");
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await cp(input.sourceRoot, destination, {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
    preserveTimestamps: true,
  });
  const stat = await lstat(destination);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Separated Build workspace is not a regular directory");
  }
  const root = await realpath(destination);
  await assertReleaseBuildCheckoutRoot(input.workRoot, root);
  return root;
}
