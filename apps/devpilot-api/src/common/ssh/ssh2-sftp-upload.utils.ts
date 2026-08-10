import type { Client } from "ssh2";
import type { SshTransportUploadOptions } from "./ssh-transport";

export function uploadSshFile(
  client: Client,
  localPath: string,
  remotePath: string,
  options: SshTransportUploadOptions,
) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(
      () =>
        finish(new Error(`SFTP upload timed out after ${options.timeoutMs}ms`)),
      options.timeoutMs,
    );
    client.sftp((error, sftp) => {
      if (error) return finish(error);
      const transferOptions =
        options.mode === undefined ? {} : { mode: options.mode };
      sftp.fastPut(localPath, remotePath, transferOptions, (uploadError) => {
        try {
          sftp.end();
        } catch {
          // The connection may already be closed after an upload failure.
        }
        finish(uploadError || undefined);
      });
    });
  });
}
