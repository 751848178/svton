import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readdir, realpath, rm } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

export async function promoteSupervisorEvidence(input: {
  trustedRoot: string;
  outputRoot: string;
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
}) {
  const ids = [input.projectId, input.releaseOrderId, input.buildRunId];
  if (ids.some((value) => !/^[A-Za-z0-9_-]+$/.test(value)))
    throw new Error("Supervisor evidence identity is invalid");
  const sourceBase = join(input.trustedRoot, "artifacts", "evidence");
  const source = join(sourceBase, ...ids);
  const targetBase = join(input.outputRoot, "artifacts", "evidence");
  const target = join(targetBase, ...ids);
  const names = await readdir(source).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  });
  if (!names.length) return 0;
  await safeDirectory(targetBase, ids);
  await Promise.all([assertDirectory(sourceBase), assertDirectory(source),
    assertDirectory(targetBase), assertDirectory(target)]);
  await assertConfined(sourceBase, source);
  await assertConfined(targetBase, target);
  for (const name of names) await promoteFile(source, target, name, input.buildRunId);
  return names.length;
}

async function promoteFile(source: string, target: string, name: string,
  buildRunId: string) {
  const matched = /^([A-Za-z0-9_-]+)-([a-f0-9]{64})\.json$/.exec(name);
  if (!matched) throw new Error("Supervisor evidence filename is invalid");
  const sourcePath = join(source, name);
  const handle = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let content: Buffer;
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > 10 * 1024 * 1024)
      throw new Error("Supervisor evidence source is invalid");
    content = await handle.readFile();
  } finally { await handle.close(); }
  if (createHash("sha256").update(content).digest("hex") !== matched[2])
    throw new Error("Supervisor evidence digest is invalid");
  const report = JSON.parse(content.toString("utf8")) as Record<string, unknown>;
  const identity = report.identity as Record<string, unknown> | undefined;
  if (identity?.buildRunId !== buildRunId)
    throw new Error("Supervisor evidence build identity is invalid");
  const temporary = join(target, `.${name}-${randomUUID()}.tmp`);
  try {
    const output = await open(temporary, "wx", 0o600);
    try { await output.writeFile(content); await output.sync(); }
    finally { await output.close(); }
    await link(temporary, join(target, name)).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
      const existing = await open(join(target, name), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const digest = createHash("sha256").update(await existing.readFile()).digest("hex");
        if (digest !== matched[2]) throw new Error("Supervisor evidence target conflicts");
      } finally { await existing.close(); }
    });
  } finally { await rm(temporary, { force: true }); }
}

async function safeDirectory(root: string, segments: string[]) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  let cursor = root;
  for (const segment of segments) {
    cursor = join(cursor, segment);
    await mkdir(cursor, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    const metadata = await lstat(cursor);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("Supervisor evidence target is not a directory");
  }
}

async function assertConfined(root: string, child: string) {
  const nested = relative(await realpath(root), await realpath(child));
  if (!nested || nested.startsWith("..") || isAbsolute(nested))
    throw new Error("Supervisor evidence path escapes configured root");
}
async function assertDirectory(path: string) {
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("Supervisor evidence directory is invalid");
}
