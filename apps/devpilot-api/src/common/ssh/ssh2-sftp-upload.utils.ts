import type { Client } from "ssh2";

export function uploadSshFile(
  client: Client,
  localPath: string,
  remotePath: string,
  timeoutMs: number,
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
      () => finish(new Error(`SFTP upload timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    client.sftp((error, sftp) => {
      if (error) return finish(error);
      sftp.fastPut(localPath, remotePath, (uploadError) => {
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
