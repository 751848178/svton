import { realpath } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";
import { exactOciImage } from "./release-build-launcher-proof.policy";

const BROKER_MAIN =
  "/app/apps/devpilot-api/dist/release-delivery/release-build-filesystem-broker.main.js";
const DOCKER_EXECUTABLES = new Set([
  "/usr/bin/docker",
  "/usr/local/bin/docker",
  "/opt/homebrew/bin/docker",
]);

export type ExternalOciJob = {
  name: string;
  image: string;
  controlRoot: string;
  sourceRoot: string;
  workRoot: string;
  outputRoot: string;
};

export function assertDockerExecutable(value: string) {
  if (!DOCKER_EXECUTABLES.has(value)) throw new Error("Docker executable is not registered");
  return value;
}

export async function assertExternalOciJob(job: ExternalOciJob, jobRoot: string) {
  if (!/^[a-z0-9][a-z0-9_.-]{7,62}$/.test(job.name) || !exactOciImage(job.image))
    throw new Error("External OCI job identity is invalid");
  const root = await realpath(jobRoot);
  const resolvedPaths: string[] = [];
  for (const path of [job.controlRoot, job.sourceRoot, job.workRoot, job.outputRoot]) {
    if (!isAbsolute(path) || path.includes(",") || path.includes("\n")) throw unsafe();
    const resolved = await realpath(path);
    const child = relative(root, resolved);
    if (!child || child.startsWith("..") || isAbsolute(child)) throw unsafe();
    resolvedPaths.push(resolved);
  }
  if (new Set(resolvedPaths).size !== resolvedPaths.length) throw unsafe();
  for (const left of resolvedPaths) for (const right of resolvedPaths) {
    if (left !== right && !relative(left, right).startsWith("..")) throw unsafe();
  }
}

export function dockerCreateArguments(job: ExternalOciJob) {
  return [
    "create", "--name", job.name,
    "--network", "none", "--read-only", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges", "--pids-limit", "128",
    "--memory", "2g", "--cpus", "2", "--user", "3000:3000",
    "--workdir", "/job", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m,mode=0700",
    "--tmpfs", "/home:rw,nosuid,nodev,size=16m,mode=0700",
    "--env", "NODE_ENV=production", "--env", "CI=true",
    "--env", "HOME=/home", "--env", "LANG=C.UTF-8",
    mount(job.controlRoot, "/job", true), mount(job.sourceRoot, "/source", true),
    mount(job.workRoot, "/work", false), mount(job.outputRoot, "/output", false),
    job.image, "node", BROKER_MAIN, "/job/broker-input.json",
  ];
}

function mount(source: string, destination: string, readonly: boolean) {
  return `--mount=type=bind,src=${source},dst=${destination}${readonly ? ",readonly" : ""}`;
}
function unsafe() { return new Error("External OCI job path escapes its private root"); }
