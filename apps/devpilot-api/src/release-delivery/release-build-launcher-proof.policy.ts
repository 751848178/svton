import { constants } from "node:fs";
import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { lstat, open, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { DependencyNetworkMode } from "./release-build-engine-network.policy";

export const EXTERNAL_OCI_LAUNCHER = "external-oci-launcher-v1" as const;
export const launcherControls = {
  schemaVersion: 1,
  network: "none",
  dependencyNetworkModes: ["docker-desktop-engine-proxy-v1",
    "direct-public-dns-v1"],
  rootFilesystem: "read-only",
  capabilities: "drop-all",
  privileges: "no-new-privileges",
  identity: "3000:3000",
  mounts: ["job-control:ro", "source:ro", "work:rw", "output:rw"],
  termination: "kill-remove-before-promote",
} as const;
export const launcherControlsDigest = stableHash(launcherControls);

export type ReleaseBuildLauncherProof = {
  schemaVersion: 1;
  provider: typeof EXTERNAL_OCI_LAUNCHER;
  profileId: "controlled-local-acceptance-v2";
  jobImage: string;
  controlsDigest: string;
  dependencyNetworkMode: DependencyNetworkMode;
  engineEvidenceDigest: string;
  launcherInstanceId: string;
  startedAt: string;
  heartbeatAt: string;
  signature: string;
};

export function exactOciImage(value: string | undefined): value is string {
  return Boolean(value && /^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(value));
}

export function signLauncherProof(
  value: Omit<ReleaseBuildLauncherProof, "signature">,
  secret: string,
): ReleaseBuildLauncherProof {
  return { ...value, signature: signature(value, secret) };
}

export async function writeLauncherProof(
  path: string,
  value: ReleaseBuildLauncherProof,
) {
  const parent = dirname(path);
  const parentStat = await lstat(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink())
    throw new Error("launcher proof directory is unsafe");
  const temporary = join(parent, `.launcher-proof-${process.pid}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value));
    await handle.sync();
  } finally { await handle.close(); }
  try { await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}

export function verifyLauncherProof(input: {
  proofFile?: string;
  secretFile?: string;
  jobImage?: string;
  now?: number;
  maximumAgeMs?: number;
}) {
  return Boolean(readVerifiedLauncherProof(input));
}

export function readVerifiedLauncherProof(input: {
  proofFile?: string; secretFile?: string; jobImage?: string;
  now?: number; maximumAgeMs?: number;
}): ReleaseBuildLauncherProof | null {
  if (!input.proofFile || !input.secretFile || !exactOciImage(input.jobImage)) return null;
  try {
    const proof = readNoFollow<ReleaseBuildLauncherProof>(input.proofFile);
    const secret = readNoFollowText(input.secretFile).trim();
    const { signature: actual, ...unsigned } = proof;
    const expected = signature(unsigned, secret);
    const age = (input.now ?? Date.now()) - new Date(proof.heartbeatAt).getTime();
    const valid = proof.schemaVersion === 1 && proof.provider === EXTERNAL_OCI_LAUNCHER &&
      proof.profileId === "controlled-local-acceptance-v2" &&
      proof.jobImage === input.jobImage && proof.controlsDigest === launcherControlsDigest &&
      ["docker-desktop-engine-proxy-v1", "direct-public-dns-v1"]
        .includes(proof.dependencyNetworkMode) &&
      /^[a-f0-9]{64}$/.test(proof.engineEvidenceDigest) &&
      /^[A-Za-z0-9_-]{16,128}$/.test(proof.launcherInstanceId) &&
      age >= 0 && age <= (input.maximumAgeMs ?? 30_000) &&
      /^[a-f0-9]{64}$/.test(actual) &&
      timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
    return valid ? proof : null;
  } catch { return null; }
}

function signature(value: unknown, secret: string) {
  const key = hkdfSync("sha256", Buffer.from(secret),
    Buffer.from(EXTERNAL_OCI_LAUNCHER), Buffer.from("launcher-heartbeat"), 32);
  return createHmac("sha256", Buffer.from(key)).update(canonicalJson(value)).digest("hex");
}

function readNoFollow<T>(path: string): T {
  return JSON.parse(readNoFollowText(path)) as T;
}
function readNoFollowText(path: string) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > 64 * 1024 || (stat.mode & 0o022) !== 0)
      throw new Error("unsafe launcher proof file");
    return readFileSync(descriptor, "utf8");
  } finally { closeSync(descriptor); }
}
