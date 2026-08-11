import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";

export type ReleasePackageManager = "npm" | "pnpm" | "yarn";

export type ReleasePackageContext = {
  root: string;
  componentRoot: string;
  manager: ReleasePackageManager;
  executable: string;
  toolVersion: string;
  scripts: Record<string, string>;
};

const LOCKFILES: Array<[string, ReleasePackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
];

export async function resolveReleasePackageContext(input: {
  checkoutRoot: string;
  componentRoot: string;
  profile: RegisteredReleaseBuildProfile;
}): Promise<ReleasePackageContext | null> {
  const packageJson = await readPackageJson(join(input.componentRoot, "package.json"));
  if (!packageJson) return null;
  let cursor = input.componentRoot;
  while (inside(input.checkoutRoot, cursor)) {
    for (const [lockfile, manager] of LOCKFILES) {
      if (await exists(join(cursor, lockfile))) {
        const tool = input.profile.packageManagers[manager];
        if (!tool) return null;
        return {
          root: cursor,
          componentRoot: input.componentRoot,
          manager,
          executable: tool.executable,
          toolVersion: tool.toolVersion,
          scripts: scriptRecord(packageJson.scripts),
        };
      }
    }
    if (cursor === input.checkoutRoot) break;
    cursor = dirname(cursor);
  }
  return null;
}

export function lockedInstallArgs(manager: ReleasePackageManager) {
  if (manager === "pnpm") return ["install", "--frozen-lockfile"];
  if (manager === "yarn") return ["install", "--frozen-lockfile", "--non-interactive"];
  return ["ci"];
}

export function packageScriptArgs(
  manager: ReleasePackageManager,
  script: string,
) {
  return manager === "yarn" ? ["run", script] : ["run", script];
}

async function readPackageJson(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function exists(path: string) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function inside(root: string, candidate: string) {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !child.startsWith("/"));
}

function scriptRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
