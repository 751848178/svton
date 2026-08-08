import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { assertPinnedBrowserOutputDirectory } from "./parity-history-safe-directory.mjs";
import { readPinnedBrowserFile } from "./parity-history-safe-file.mjs";

export const ARTIFACT_MIN_BYTES = {
  screenshot: 128,
  dom: 64,
  text: 16,
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function artifactMetadata(kind, buffer) {
  validateArtifactBuffer(kind, buffer);
  return {
    kind,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function readBackBrowserArtifacts(
  entries,
  directoryPin,
  options = {},
) {
  const outputDirectory = directoryPin?.lexicalPath;
  await assertPinnedBrowserOutputDirectory(directoryPin);
  const artifacts = {};
  const contents = {};
  for (const entry of entries) {
    const fields = ["screenshot", "dom", "text"].filter(
      (field) => entry?.[field] !== undefined,
    );
    if (fields.length === 0) continue;
    if (fields.length !== 1) throw artifactError("ambiguous-entry");
    const field = fields[0];
    const reportedPath = entry[field];
    if (typeof reportedPath !== "string") throw artifactError("invalid-path");
    const name = basename(reportedPath);
    const controlledPath = resolve(outputDirectory, name);
    if (
      resolve(reportedPath) !== controlledPath ||
      dirname(controlledPath) !== outputDirectory
    ) {
      throw artifactError("outside-output");
    }
    if (Object.hasOwn(artifacts, name)) throw artifactError("duplicate");
    if (entry.kind !== field) throw artifactError("kind-field-mismatch");
    const snapshot = await readPinnedBrowserFile(directoryPin, name, {
      parentGuard: (phase) => options.parentGuard?.({ phase, name }),
    });
    const actual = artifactMetadata(entry.kind, snapshot.buffer);
    if (!browserArtifactsValid([name], { [name]: actual })) {
      throw artifactError("filename-kind-mismatch");
    }
    if (
      entry.sha256 !== actual.sha256 ||
      entry.bytes !== actual.bytes ||
      entry.kind !== actual.kind
    ) {
      throw artifactError("metadata-mismatch");
    }
    await assertPinnedBrowserOutputDirectory(directoryPin);
    artifacts[name] = actual;
    contents[name] = snapshot.buffer;
    await options.afterChild?.({ name });
  }
  return { artifacts, contents };
}

export function validateArtifactBuffer(kind, buffer) {
  const minimum = ARTIFACT_MIN_BYTES[kind];
  const signatureValid = kind !== "screenshot" || hasPngSignature(buffer);
  if (
    !Buffer.isBuffer(buffer) ||
    !Number.isInteger(minimum) ||
    buffer.length < minimum ||
    !signatureValid
  ) {
    throw new Error(`E2E_ARTIFACT_CONTENT_INVALID: ${kind}`);
  }
  return buffer;
}

export function browserArtifactsValid(required, artifacts) {
  return (
    Array.isArray(required) &&
    required.length > 0 &&
    new Set(required).size === required.length &&
    required.every((name) => metadataValid(name, artifacts?.[name]))
  );
}

function metadataValid(name, metadata) {
  const expectedKind = kindForName(name);
  return (
    Boolean(expectedKind) &&
    metadata?.kind === expectedKind &&
    Number.isInteger(metadata.bytes) &&
    metadata.bytes >= ARTIFACT_MIN_BYTES[expectedKind] &&
    /^[a-f0-9]{64}$/.test(metadata.sha256 || "")
  );
}

function kindForName(name) {
  if (typeof name !== "string") return null;
  if (name.endsWith(".png")) return "screenshot";
  if (name.endsWith(".html")) return "dom";
  if (name.endsWith(".txt")) return "text";
  return null;
}

function hasPngSignature(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  );
}

function artifactError(reason) {
  return new Error(`E2E_ARTIFACT_READBACK_INVALID: ${reason}`);
}
