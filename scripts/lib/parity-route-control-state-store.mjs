import { constants } from "node:fs";
import { chmod, lstat, open, realpath, rename, rm,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { EMPTY_ROUTE_STATE, validateRouteControlState,
} from "./parity-route-control-policy.mjs";

export function createRouteControlStateStore(stateFile) {
  if (typeof stateFile !== "string" || !stateFile.startsWith("/"))
    throw new Error("ROUTE_CONTROL_STATE_FILE must be absolute");
  let state;
  let unhealthy;
  let mutation = Promise.resolve();
  const ready = loadState(stateFile).then((loaded) => { state = loaded; })
    .catch((error) => { unhealthy = safeError(error); });
  return {
    async assertReady() { await ready; assertHealthy(unhealthy); },
    async health() { await ready; return unhealthy ? { status: "unhealthy",
      reason: unhealthy } : { status: "ok" }; },
    async read(reader) { await ready; assertHealthy(unhealthy); return reader(state); },
    mutate(writer) {
      const result = mutation.then(async () => {
        await ready;
        assertHealthy(unhealthy);
        const outcome = writer(state);
        if (outcome.state !== state) {
          await writeAtomic(stateFile, outcome.state);
          state = outcome.state;
        }
        return outcome.value;
      });
      mutation = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

async function loadState(path) {
  await ensureParent(path);
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() ||
      (metadata.mode & 0o077) !== 0) throw new Error("state_file_unsafe");
    return validateRouteControlState(JSON.parse(await readFileNoFollow(path)));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeAtomic(path, EMPTY_ROUTE_STATE);
    return structuredClone(EMPTY_ROUTE_STATE);
  }
}

async function writeAtomic(path, state) {
  const parent = await ensureParent(path);
  const temporary = join(parent, `.${basename(path)}-${process.pid}-${Date.now()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT |
      constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(`${JSON.stringify(state)}\n`);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, path);
    await chmod(path, 0o600);
    const directory = await open(parent, constants.O_RDONLY);
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function ensureParent(path) {
  const parent = dirname(path);
  const resolved = await realpath(parent);
  const root = await lstat("/");
  let cursor = "/";
  for (const segment of resolved.split("/").filter(Boolean)) {
    cursor = join(cursor, segment);
    const metadata = await lstat(cursor);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("state_parent_unsafe");
    if (cursor !== "/" && metadata.uid !== process.getuid() &&
      metadata.uid !== root.uid) throw new Error("state_parent_owner_invalid");
    if (metadata.mode & 0o022) throw new Error("state_parent_writable");
  }
  return resolved;
}
async function readFileNoFollow(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return await handle.readFile("utf8"); } finally { await handle.close(); }
}
function assertHealthy(reason) { if (reason) throw Object.assign(
  new Error(`route_state_unhealthy:${reason}`), { statusCode: 503 }); }
function safeError(error) { return error instanceof Error ? error.message : "state_invalid"; }
