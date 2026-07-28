import {
  SshTransport,
  SshTransportCredentials,
} from "../../common/ssh/ssh-transport";
import { buildSshLiveRemoteKillCommand } from "./ssh-live-script.utils";
import { truncateSshOutput } from "./ssh-live-json.utils";

/**
 * transport 凭据映射的再导出：历史调用点（adapter execute/cleanup/stale recovery）
 * 统一从 `ssh-credential-mapping.utils` 取单一实现，避免重复分支。
 */
export {
  toSshTransportCredentials,
  type DecryptedServerCredentials,
} from "./ssh-credential-mapping.utils";

export type { SshTransportCredentials } from "../../common/ssh/ssh-transport";

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
