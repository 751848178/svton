import { createHash } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import { extname } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  containsRepositorySecretText,
  containsRepositoryStructuredSecretText,
} from "../repository-analysis/repository-analysis-redact.utils";
import { artifactFailure } from "./release-build-artifact-policy";

export async function copyReleaseBuildArtifactFile(
  source: string,
  target: string,
) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    await pipeline(
      handle.createReadStream({ autoClose: false }),
      createWriteStream(target, { flags: "wx", mode: 0o600 }),
    );
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export async function inspectReleaseBuildArtifactFile(
  path: string,
  signal?: AbortSignal,
) {
  const hash = createHash("sha256");
  let carry = "";
  let sizeBytes = 0;
  for await (const chunk of createReadStream(
    path,
    signal ? { signal } : undefined,
  )) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    sizeBytes += bytes.length;
    const text = `${carry}${bytes.toString("utf8")}`;
    if (
      containsRepositorySecretText(text) ||
      (structured(path) && containsRepositoryStructuredSecretText(text))
    ) {
      throw artifactFailure(
        "ARTIFACT_SECRET_CONTENT",
        "制品输出包含疑似秘密内容",
      );
    }
    carry = text.slice(-1_000);
  }
  return { digest: `sha256:${hash.digest("hex")}`, sizeBytes };
}

function structured(path: string) {
  return [".json", ".yaml", ".yml"].includes(extname(path).toLowerCase());
}
