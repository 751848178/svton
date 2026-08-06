import { uploadSshFile } from "./ssh2-sftp-upload.utils";

describe("uploadSshFile", () => {
  it("passes an explicit remote mode to ssh2 fastPut", async () => {
    const end = jest.fn();
    const fastPut = jest.fn(
      (
        _localPath: string,
        _remotePath: string,
        _options: { mode?: number },
        callback: (error?: Error) => void,
      ) => callback(),
    );
    const sftp = { fastPut, end };
    const client = {
      sftp: jest.fn(
        (
          callback: (error: Error | undefined, connection: typeof sftp) => void,
        ) => callback(undefined, sftp),
      ),
    };

    await uploadSshFile(client as never, "/tmp/runtime.env", "/incoming.env", {
      timeoutMs: 5_000,
      mode: 0o600,
    });

    expect(fastPut).toHaveBeenCalledWith(
      "/tmp/runtime.env",
      "/incoming.env",
      { mode: 0o600 },
      expect.any(Function),
    );
    expect(end).toHaveBeenCalledTimes(1);
  });
});
