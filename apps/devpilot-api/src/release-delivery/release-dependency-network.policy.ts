import { exactOciImage } from "./release-build-launcher-proof.policy";
import { RELEASE_DEPENDENCY_STORE_CONTRACT } from "./release-dependency-store-contract";

const FETCHER_MAIN =
  "/app/apps/devpilot-api/dist/release-delivery/release-dependency-fetcher.main.js";
const PROXY_MAIN =
  "/app/apps/devpilot-api/dist/release-delivery/release-registry-egress-proxy.main.js";

export type DependencyNetworkJob = {
  fetchName: string; proxyName: string; networkName: string;
  launcherLabel: string; image: string; controlRoot: string; outputRoot: string;
};

export function dependencyNetworkCreateArguments(job: DependencyNetworkJob) {
  assert(job);
  return ["network", "create", "--internal",
    "--label", `devpilot.release-build.launcher=${job.launcherLabel}`,
    "--label", `devpilot.release-build.contract=${RELEASE_DEPENDENCY_STORE_CONTRACT}`,
    job.networkName];
}

export function dependencyProxyCreateArguments(job: DependencyNetworkJob) {
  assert(job);
  return ["create", "--name", job.proxyName,
    ...labels(job), "--network", "bridge", "--read-only", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges", "--pids-limit", "32",
    "--memory", "128m", "--cpus", "0.25", "--user", "3000:3000",
    "--tmpfs", "/tmp:rw,nosuid,nodev,size=8m,mode=0700",
    job.image, "node", PROXY_MAIN];
}

export function dependencyProxyConnectArguments(job: DependencyNetworkJob) {
  assert(job);
  return ["network", "connect", "--alias", "registry-egress-proxy",
    job.networkName, job.proxyName];
}

export function dependencyFetcherCreateArguments(job: DependencyNetworkJob) {
  assert(job);
  return ["create", "--name", job.fetchName, ...labels(job),
    "--network", job.networkName, "--read-only", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges", "--pids-limit", "64",
    "--memory", "1g", "--cpus", "1", "--user", "3000:3000",
    "--workdir", "/job", "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=64m,mode=0700,uid=3000,gid=3000",
    "--tmpfs", "/home:rw,nosuid,nodev,size=16m,mode=0700,uid=3000,gid=3000",
    "--env", "HOME=/home", "--env", "CI=true",
    "--env", "HTTPS_PROXY=http://registry-egress-proxy:3128",
    "--env", "HTTP_PROXY=http://registry-egress-proxy:3128",
    "--env", "NO_PROXY=", "--env", "npm_config_proxy=http://registry-egress-proxy:3128",
    "--env", "npm_config_https_proxy=http://registry-egress-proxy:3128",
    "--env", "npm_config_registry=https://registry.npmjs.org",
    "--env", "npm_config_ignore_scripts=true",
    mount(job.controlRoot, "/job", true), mount(job.outputRoot, "/output", false),
    job.image, "node", FETCHER_MAIN, "/job/fetch-input.json"];
}

function labels(job: DependencyNetworkJob) {
  return ["--label", `devpilot.release-build.launcher=${job.launcherLabel}`,
    "--label", `devpilot.release-build.contract=${RELEASE_DEPENDENCY_STORE_CONTRACT}`];
}
function assert(job: DependencyNetworkJob) {
  for (const value of [job.fetchName, job.proxyName, job.networkName,
    job.launcherLabel]) if (!/^[a-z0-9][a-z0-9_.-]{15,62}$/.test(value)) throw invalid();
  if (!exactOciImage(job.image)) throw invalid();
}
function mount(source: string, destination: string, readonly: boolean) {
  return `--mount=type=bind,src=${source},dst=${destination}${readonly ? ",readonly" : ""}`;
}
function invalid() { return new Error("Dependency network identity is invalid"); }
