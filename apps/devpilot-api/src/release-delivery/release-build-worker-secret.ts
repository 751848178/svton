import { constants } from "node:fs";
import { open } from "node:fs/promises";

export async function readReleaseBuildWorkerSecret(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 32 || stat.size > 4096) {
      throw new Error("Release Build worker secret file is invalid");
    }
    const secret = (await handle.readFile("utf8")).trim();
    if (secret.length < 32 || /[\r\n\0]/.test(secret)) {
      throw new Error("Release Build worker secret is too short or malformed");
    }
    return secret;
  } finally {
    await handle.close();
  }
}
