import { ServerService } from "../../server/server.service";
import {
  SshTransport,
  SshTransportCredentials,
} from "../../common/ssh/ssh-transport";
import { buildSshLiveRemoteKillCommand } from "./ssh-live-script.utils";
import { truncateSshOutput } from "./ssh-live-json.utils";

export function toSshTransportCredentials(
  credentials: Awaited<ReturnType<ServerService["getDecryptedCredentials"]>>,
): SshTransportCredentials {
  return {
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
    privateKey: credentials.credentials,
  };
}

export async function killSshRemoteProcessTree(
  transport: SshTransport,
  pid: number,
  timeoutMs: number,
): Promise<void> {
  if (!Number.isSafeInteger(pid) || pid <= 1) {
    throw new Error("remote process pid is invalid");
  }
  const command = buildSshLiveRemoteKillCommand(pid);
  const result = await transport.execCommand(command, { timeoutMs });
  if (result.exitCode !== null && result.exitCode !== 0) {
    throw new Error(
      `remote cleanup exit code ${result.exitCode}: ${truncateSshOutput(result.stderr)}`,
    );
  }
}
