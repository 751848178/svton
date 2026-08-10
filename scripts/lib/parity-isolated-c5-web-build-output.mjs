import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export function materializeC5WebBuildOutput(cache, environment) {
  const identity = outputIdentity(environment);
  const source = join(cache.root, "dist");
  requireDirectory(source);
  requireBuildShape(source);
  if (existsSync(identity.output) || existsSync(identity.ownerPath)) {
    throw outputError("destination-exists");
  }
  const sourceTree = treeSnapshot(source);
  try {
    cpSync(source, identity.output, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    const outputTree = treeSnapshot(identity.output);
    if (JSON.stringify(outputTree) !== JSON.stringify(sourceTree)) {
      throw outputError("copy-readback");
    }
    const receipt = { ...identity.owner, tree: outputTree };
    writeFileSync(identity.ownerPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    return Object.freeze({
      status: "materialized",
      path: identity.output,
      ownerPath: identity.ownerPath,
      tree: outputTree,
    });
  } catch (error) {
    rmSync(identity.output, { recursive: true, force: true });
    if (existsSync(identity.ownerPath)) unlinkSync(identity.ownerPath);
    throw error;
  }
}

export function cleanupC5WebBuildOutput(environment) {
  if (!environment.PARITY_WEB_DIST_ROOT) {
    return Object.freeze({ status: "not_requested" });
  }
  const identity = outputIdentity(environment);
  const outputExists = existsSync(identity.output);
  const ownerExists = existsSync(identity.ownerPath);
  if (!outputExists && !ownerExists) {
    return Object.freeze({ status: "already_absent" });
  }
  if (!outputExists || !ownerExists) throw outputError("partial-ownership");
  requireFile(identity.ownerPath);
  const receipt = JSON.parse(readFileSync(identity.ownerPath, "utf8"));
  const { tree, ...owner } = receipt;
  if (
    JSON.stringify(owner) !== JSON.stringify(identity.owner) ||
    JSON.stringify(treeSnapshot(identity.output)) !== JSON.stringify(tree)
  ) {
    throw outputError("owner-or-tree");
  }
  rmSync(identity.output, { recursive: true, force: false });
  unlinkSync(identity.ownerPath);
  if (existsSync(identity.output) || existsSync(identity.ownerPath)) {
    throw outputError("cleanup-residual");
  }
  return Object.freeze({ status: "removed", tree });
}

function outputIdentity(environment) {
  const manifestPath = resolve(environment.PARITY_C5_MANIFEST_PATH || "");
  const runDirectory = dirname(manifestPath);
  const output = resolve(environment.PARITY_WEB_DIST_ROOT || "");
  const ownerPath = `${output}.owner.json`;
  if (
    manifestPath !== join(runDirectory, "runtime.json") ||
    output !== join(runDirectory, "web-image-dist") ||
    !/^c5-[a-f0-9]{8}-[a-f0-9]{32}$/.test(
      environment.PARITY_RUNTIME_ID || "",
    ) ||
    !/^[a-f0-9]{40}$/.test(environment.PARITY_SOURCE_REVISION || "") ||
    !/^[a-f0-9]{64}$/.test(environment.PARITY_SOURCE_TREE_SHA256 || "") ||
    !/^[a-f0-9]{64}$/.test(environment.PARITY_CLEANUP_OWNER_TOKEN || "")
  ) {
    throw outputError("identity");
  }
  requireDirectory(runDirectory);
  return {
    output,
    ownerPath,
    owner: {
      schemaVersion: 1,
      runtimeId: environment.PARITY_RUNTIME_ID,
      goalId: environment.PARITY_GOAL_ID,
      sourceRevision: environment.PARITY_SOURCE_REVISION,
      sourceTreeSha256: environment.PARITY_SOURCE_TREE_SHA256,
      nextPublicApiUrl: environment.NEXT_PUBLIC_API_URL,
      cleanupOwnerFingerprint: createHash("sha256")
        .update(environment.PARITY_CLEANUP_OWNER_TOKEN)
        .digest("hex"),
    },
  };
}

function treeSnapshot(root) {
  requireDirectory(root);
  const hash = createHash("sha256");
  let files = 0;
  let bytes = 0;
  walk(root, root, (path) => {
    const content = readFileSync(path);
    const name = relative(root, path);
    hash.update(`${name}\0${content.length}\0`);
    hash.update(content);
    files += 1;
    bytes += content.length;
  });
  return { files, bytes, sha256: hash.digest("hex") };
}

function walk(root, current, visit) {
  for (const name of readdirSync(current).sort()) {
    const path = join(current, name);
    const stats = lstatSync(path, { bigint: true });
    if (stats.isSymbolicLink() || stats.uid !== BigInt(process.geteuid())) {
      throw outputError("entry-owner");
    }
    if (stats.isDirectory()) walk(root, path, visit);
    else if (stats.isFile()) visit(path);
    else throw outputError("entry-type");
  }
}

function requireBuildShape(root) {
  requireFile(join(root, "BUILD_ID"));
  requireDirectory(join(root, "server"));
  requireDirectory(join(root, "static"));
}

function requireDirectory(path) {
  const stats = lstatSync(path, { bigint: true });
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.uid !== BigInt(process.geteuid()) ||
    realpathSync(path) !== path
  ) {
    throw outputError("directory");
  }
}

function requireFile(path) {
  const stats = lstatSync(path, { bigint: true });
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.uid !== BigInt(process.geteuid())
  ) {
    throw outputError("file");
  }
}

function outputError(reason) {
  return new Error(`PARITY_C5_WEB_BUILD_OUTPUT_INVALID:${reason}`);
}
