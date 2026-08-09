import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { artifactMetadata } from "./parity-history-browser-artifacts.mjs";
import { validateCdpEvidence } from "./parity-history-cdp-capture.mjs";

const RECEIPT = "browser-evidence-receipt.json";

export async function persistHistoryBrowserEvidence(options) {
  if (!options.runRoot) return Object.freeze({ status: "not_requested" });
  const runRoot = await secureDirectory(options.runRoot);
  const outputDirectory = await secureDirectory(options.outputDirectory);
  if (outputDirectory !== join(runRoot, "f456")) {
    throw persistenceError("output-scope");
  }
  validateSession(options.session);
  const evidenceDirectory = join(outputDirectory, "browser-evidence");
  await mkdir(evidenceDirectory, { mode: 0o700 });
  const artifacts = {};
  for (const name of options.session.outputNames) {
    requireName(name);
    const buffer = options.session.contents[name];
    const actual = artifactMetadata(
      options.session.artifacts[name]?.kind,
      buffer,
    );
    if (!sameMetadata(actual, options.session.artifacts[name])) {
      throw persistenceError(`artifact-mismatch:${name}`);
    }
    const destination = join(evidenceDirectory, name);
    await writeFile(destination, buffer, { flag: "wx", mode: 0o600 });
    artifacts[name] = { ...actual, path: destination };
  }
  const cdpBuffer = Buffer.from(
    `${JSON.stringify(options.session.cdpEvidence, null, 2)}\n`,
  );
  const cdpPath = join(evidenceDirectory, "cdp-evidence.json");
  await writeFile(cdpPath, cdpBuffer, { flag: "wx", mode: 0o600 });
  const receipt = {
    schema: "devpilot.parity-history.browser-evidence-receipt",
    version: 1,
    status: "persisted",
    capturedAt: new Date().toISOString(),
    evidenceDirectory,
    artifacts,
    cdp: {
      path: cdpPath,
      bytes: cdpBuffer.length,
      sha256: sha256(cdpBuffer),
      schema: options.session.cdpEvidence.schema,
      version: options.session.cdpEvidence.version,
      session: options.session.cdpEvidence.session,
    },
  };
  const receiptPath = join(evidenceDirectory, RECEIPT);
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return Object.freeze({ ...receipt, receiptPath });
}

async function secureDirectory(value) {
  if (typeof value !== "string" || resolve(value) !== value) {
    throw persistenceError("directory-path");
  }
  const stats = await lstat(value);
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.uid !== process.geteuid()
  ) {
    throw persistenceError("directory-owner");
  }
  await chmod(value, 0o700);
  const canonical = await realpath(value);
  if (canonical !== value) throw persistenceError("directory-canonical");
  return canonical;
}

function validateSession(session) {
  validateCdpEvidence(session?.cdpEvidence);
  if (
    !Array.isArray(session?.outputNames) ||
    new Set(session.outputNames).size !== session.outputNames.length ||
    !session?.artifacts ||
    !session?.contents
  ) {
    throw persistenceError("session");
  }
}

function requireName(name) {
  if (typeof name !== "string" || basename(name) !== name || name === RECEIPT) {
    throw persistenceError("artifact-name");
  }
}

function sameMetadata(left, right) {
  return (
    left.kind === right?.kind &&
    left.bytes === right?.bytes &&
    left.sha256 === right?.sha256
  );
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function persistenceError(reason) {
  return new Error(`F532_BROWSER_EVIDENCE_PERSISTENCE_INVALID:${reason}`);
}
