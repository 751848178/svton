import { constants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rm,
  chown,
} from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

export function assertWorkerJobId(value: string) {
  if (!/^[A-Za-z0-9_-]{8,191}$/.test(value)) {
    throw new Error("Release Build worker job id is invalid");
  }
  return value;
}

export async function workerJobDirectory(
  root: string,
  jobId: string,
  create: boolean,
  sharedGid: number = process.getgid?.() ?? 0,
) {
  assertWorkerJobId(jobId);
  if (create) await mkdir(root, { recursive: true, mode: 0o750 });
  if (create) await chown(root, process.getuid?.() ?? 0, sharedGid);
  await assertDirectory(root);
  const directory = join(root, jobId);
  if (create) {
    await mkdir(directory, { mode: 0o750 }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      },
    );
    await chown(directory, process.getuid?.() ?? 0, sharedGid);
  }
  await assertDirectory(directory);
  await assertConfined(root, directory);
  return directory;
}

export async function writeImmutableWorkerJson(
  directory: string,
  filename: string,
  value: unknown,
  sharedGid: number = process.getgid?.() ?? 0,
) {
  const content = Buffer.from(JSON.stringify(value));
  if (content.byteLength > 10 * 1024 * 1024) {
    throw new Error("Release Build worker envelope exceeds 10 MiB");
  }
  const temporary = join(directory, `.${filename}-${process.pid}.tmp`);
  const target = join(directory, filename);
  const handle = await open(temporary, "wx", 0o640);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chown(temporary, process.getuid?.() ?? 0, sharedGid);
  try {
    await link(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return target;
}

export async function readImmutableWorkerJson<T>(path: string): Promise<T> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 10 * 1024 * 1024) {
      throw new Error("Release Build worker envelope is not a bounded file");
    }
    return JSON.parse(await handle.readFile("utf8")) as T;
  } finally {
    await handle.close();
  }
}

export async function publishImmutableWorkerFile(
  temporary: string,
  target: string,
  sharedGid: number = process.getgid?.() ?? 0,
) {
  const stat = await lstat(temporary);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Release Build worker source is not a regular file");
  }
  await chown(temporary, process.getuid?.() ?? 0, sharedGid);
  try {
    await link(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function assertDirectory(path: string) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Release Build worker exchange directory is unsafe");
  }
}

async function assertConfined(root: string, directory: string) {
  const child = relative(await realpath(root), await realpath(directory));
  if (child.startsWith("..") || isAbsolute(child)) {
    throw new Error("Release Build worker exchange escapes configured root");
  }
}
