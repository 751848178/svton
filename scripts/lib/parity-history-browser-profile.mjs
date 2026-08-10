import { lstatSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PREFIX = "svton-f456-profile-";

export function createBrowserProfile() {
  const root = realpathSync(tmpdir());
  const path = mkdtempSync(join(root, PREFIX));
  const stats = lstatSync(path, { bigint: true });
  requireProfile(stats, "create-policy");
  return Object.freeze({
    path,
    identity: Object.freeze({
      dev: stats.dev.toString(),
      ino: stats.ino.toString(),
    }),
  });
}

export function cleanupBrowserProfile(profile) {
  const stats = lstatSync(profile?.path, { bigint: true });
  requireProfile(stats, "cleanup-policy");
  requireValue(
    stats.dev.toString() === profile.identity.dev &&
      stats.ino.toString() === profile.identity.ino,
    "cleanup-identity",
  );
  rmSync(profile.path, { recursive: true, force: false });
}

function requireProfile(stats, reason) {
  requireValue(stats.isDirectory(), reason);
  requireValue(!stats.isSymbolicLink(), reason);
  requireValue(stats.uid === BigInt(process.geteuid()), reason);
  requireValue((stats.mode & 0o777n) === 0o700n, reason);
}

function requireValue(value, reason) {
  if (!value) throw new Error(`E2E_CDP_PROFILE_INVALID:${reason}`);
}
