import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import { runExternalOciCommand } from "./release-build-external-oci-command";

export type DependencyNetworkMode =
  "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
export type DockerEngineNetworkEvidence = {
  operatingSystem: string; osType: "linux";
  httpProxy: string; httpsProxy: string;
  dependencyNetworkMode: DependencyNetworkMode;
  engineEvidenceDigest: string;
};

const INFO_FORMAT = '{{json .OperatingSystem}}|{{json .OSType}}|'+
  '{{json .HTTPProxy}}|{{json .HTTPSProxy}}';
const DESKTOP_PROXY = "http.docker.internal:3128";

export async function probeDockerEngineNetwork(executable: string) {
  const result = await runExternalOciCommand(executable,
    ["info", "--format", INFO_FORMAT], 10_000);
  if (result.stdout.length > 4096) throw unavailable();
  return resolveDockerEngineNetwork(result.stdout.toString("utf8").trim());
}

export function resolveDockerEngineNetwork(value: string):
  DockerEngineNetworkEvidence {
  const parts = value.split("|");
  if (parts.length !== 4) throw unavailable();
  let rows: unknown[];
  try { rows = parts.map((part) => JSON.parse(part)); }
  catch { throw unavailable(); }
  if (!rows.every((row) => typeof row === "string" && row.length <= 256))
    throw unavailable();
  const [operatingSystem, osType, httpProxy, httpsProxy] = rows as string[];
  if (osType !== "linux") throw unavailable();
  let dependencyNetworkMode: DependencyNetworkMode;
  if (operatingSystem === "Docker Desktop" && httpProxy === DESKTOP_PROXY &&
    httpsProxy === DESKTOP_PROXY) {
    dependencyNetworkMode = "docker-desktop-engine-proxy-v1";
  } else if (operatingSystem !== "Docker Desktop" && !httpProxy && !httpsProxy) {
    dependencyNetworkMode = "direct-public-dns-v1";
  } else throw unavailable();
  const tuple = { operatingSystem, osType: "linux" as const, httpProxy,
    httpsProxy, dependencyNetworkMode };
  return { ...tuple, engineEvidenceDigest: stableHash({
    scope: "release-build-docker-engine-network-v1", ...tuple }) };
}

function unavailable() {
  return new Error("release_build_dependency_network_unavailable");
}
