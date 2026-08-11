import { constants } from "node:fs";
import { access, lstat, realpath } from "node:fs/promises";
import { isAbsolute, parse, relative, resolve } from "node:path";

export type ReleaseBuildLauncherHostPaths = {
  inputRoot: string;
  outputRoot: string;
  workRoot: string;
  proofFile: string;
  secretFile: string;
  supplyProofFile: string;
  dockerExecutable: string;
  toolExecutables: string[];
};

export async function assertReleaseBuildLauncherHostContract(
  paths: ReleaseBuildLauncherHostPaths,
  expectedOwnerUid = 0,
) {
  const fixed = await Promise.all([
    securePath(paths.inputRoot, "directory", expectedOwnerUid),
    securePath(paths.outputRoot, "directory", expectedOwnerUid),
    securePath(paths.workRoot, "directory", expectedOwnerUid),
    securePath(paths.proofFile, "file", expectedOwnerUid),
    securePath(paths.secretFile, "file", expectedOwnerUid),
    securePath(paths.supplyProofFile, "file", expectedOwnerUid),
    securePath(paths.dockerExecutable, "executable", expectedOwnerUid),
  ]);
  const tools = await Promise.all(paths.toolExecutables.map((value) =>
    securePath(value, "executable", expectedOwnerUid)));
  const entries = [...fixed, ...tools];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      if (contains(entries[left], entries[right]) || contains(entries[right], entries[left]))
        throw new Error("release-build launcher host paths overlap");
    }
  }
  return Object.freeze({
    inputRoot: fixed[0], outputRoot: fixed[1], workRoot: fixed[2],
    proofFile: fixed[3], secretFile: fixed[4], supplyProofFile: fixed[5],
    dockerExecutable: fixed[6], toolExecutables: tools,
  });
}

async function securePath(
  value: string,
  kind: "directory" | "file" | "executable",
  expectedOwnerUid: number,
) {
  if (!isAbsolute(value)) throw new Error("release-build launcher path must be absolute");
  await assertSecureAncestry(resolve(value), expectedOwnerUid);
  const canonical = await realpath(value);
  const stat = await lstat(canonical);
  if (stat.uid !== expectedOwnerUid || (stat.mode & 0o022) !== 0)
    throw new Error("release-build launcher path owner or mode is unsafe");
  if (kind === "directory" && !stat.isDirectory()) throw wrongType();
  if (kind !== "directory" && !stat.isFile()) throw wrongType();
  if (kind === "executable") await access(canonical, constants.X_OK);
  return canonical;
}

async function assertSecureAncestry(value: string, expectedOwnerUid: number) {
  const root = parse(value).root;
  const parts = value.slice(root.length).split("/").filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink())
      throw new Error("release-build launcher path contains symlink");
    if ((stat.uid !== 0 && stat.uid !== expectedOwnerUid) || (stat.mode & 0o022) !== 0)
      throw new Error("release-build launcher path ancestry owner or mode is unsafe");
  }
}

function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}
function wrongType() { return new Error("release-build launcher path type is invalid"); }
