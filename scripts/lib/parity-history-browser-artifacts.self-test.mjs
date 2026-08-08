#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARTIFACT_MIN_BYTES,
  artifactMetadata,
  browserArtifactsValid,
  readBackBrowserArtifacts,
} from "./parity-history-browser-artifacts.mjs";
import {
  closePinnedBrowserOutputDirectory,
  pinBrowserOutputDirectory,
} from "./parity-history-safe-directory.mjs";
import { readPinnedBrowserFile } from "./parity-history-safe-file.mjs";

const buffers = {
  screenshot: Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(ARTIFACT_MIN_BYTES.screenshot - 8, 1),
  ]),
  dom: Buffer.from(
    `<!doctype html><html><body>${"d".repeat(64)}</body></html>`,
  ),
  text: Buffer.from("t".repeat(ARTIFACT_MIN_BYTES.text)),
};
const names = {
  screenshot: "proof.png",
  dom: "proof.html",
  text: "proof.txt",
};
const required = Object.values(names);
const valid = Object.fromEntries(
  Object.entries(names).map(([kind, name]) => [
    name,
    artifactMetadata(kind, buffers[kind]),
  ]),
);

assert.equal(browserArtifactsValid(required, valid), true);
const trustedRoot = await mkdtemp(join(tmpdir(), "f540-artifacts-"));
const browserOut = join(trustedRoot, "browser");
await mkdir(`${browserOut}/profile`, { recursive: true });
const entries = Object.entries(names).map(([kind, name]) => ({
  [kind]: `${browserOut}/${name}`,
  ...valid[name],
}));
const files = Object.fromEntries(
  Object.entries(names).map(([kind, name]) => [
    `${browserOut}/${name}`,
    buffers[kind],
  ]),
);
await writeFixtures();
await writeFile(`${browserOut}/cdp-evidence.json`, "{}");
await writeFile(`${browserOut}/wrong.txt`, buffers.screenshot);
const directoryPin = await pinBrowserOutputDirectory(browserOut, trustedRoot);
const phases = [];
const snapshot = await readBackBrowserArtifacts(entries, directoryPin, {
  parentGuard: ({ name, phase }) => phases.push(`${name}:${phase}`),
});
assert.deepEqual(snapshot.artifacts, valid);
for (const [kind, name] of Object.entries(names)) {
  assert.deepEqual(snapshot.contents[name], buffers[kind]);
  for (const phase of ["before", "opened", "after", "complete"]) {
    assert.ok(phases.includes(`${name}:${phase}`));
  }
}
await writeFile(`${browserOut}/proof.txt`, Buffer.from("changed-path-content"));
assert.deepEqual(snapshot.contents["proof.txt"], buffers.text);
assert.equal(
  artifactMetadata("text", snapshot.contents["proof.txt"]).sha256,
  snapshot.artifacts["proof.txt"].sha256,
);
await rejectsReadback((reported) => {
  reported[0].sha256 = "0".repeat(64);
});
await rejectsReadback((reported) => {
  reported[0].bytes += 1;
});
await rejectsReadback((reported) => {
  reported[0].kind = "text";
});
await rejectsReadback(
  () => {},
  async () => {
    await writeFile(`${browserOut}/proof.txt`, Buffer.alloc(0));
  },
);
await rejectsReadback(
  () => {},
  async () => {
    await writeFile(
      `${browserOut}/proof.html`,
      Buffer.alloc(ARTIFACT_MIN_BYTES.dom - 1),
    );
  },
);
await rejectsReadback(
  () => {},
  async () => {
    await writeFile(
      `${browserOut}/proof.png`,
      Buffer.alloc(ARTIFACT_MIN_BYTES.screenshot, 1),
    );
  },
);
await rejectsReadback((reported) => {
  reported[0].screenshot = "/tmp/outside/proof.png";
});
await rejectsReadback((reported) => {
  reported[0].screenshot = `${browserOut}/nested/proof.png`;
});
await rejectsReadback((reported) => {
  reported[0].text = `${browserOut}/proof.txt`;
});
await rejectsReadback((reported) => {
  reported.push(structuredClone(reported[0]));
});
await writeFile(`${browserOut}/wrong.txt`, buffers.screenshot);
await assert.rejects(
  () =>
    readBackBrowserArtifacts(
      [{ screenshot: `${browserOut}/wrong.txt`, ...valid["proof.png"] }],
      directoryPin,
    ),
  /E2E_ARTIFACT_READBACK_INVALID/,
);
for (const [kind, name] of Object.entries(names)) {
  assert.throws(
    () => artifactMetadata(kind, Buffer.alloc(0)),
    /E2E_ARTIFACT_CONTENT_INVALID/,
  );
  assert.throws(
    () => artifactMetadata(kind, Buffer.alloc(ARTIFACT_MIN_BYTES[kind] - 1)),
    /E2E_ARTIFACT_CONTENT_INVALID/,
  );
  rejects(name, (metadata) => {
    delete metadata[name];
  });
  rejects(name, (metadata) => {
    metadata[name] = {};
  });
  rejects(name, (metadata) => {
    metadata[name].bytes = 0;
  });
  rejects(name, (metadata) => {
    metadata[name].bytes = ARTIFACT_MIN_BYTES[kind] - 1;
  });
  rejects(name, (metadata) => {
    metadata[name].kind = kind === "text" ? "dom" : "text";
  });
  rejects(name, (metadata) => {
    metadata[name].sha256 = "invalid";
  });
}
assert.throws(
  () =>
    artifactMetadata(
      "screenshot",
      Buffer.alloc(ARTIFACT_MIN_BYTES.screenshot, 1),
    ),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);
const driver = await readFile(
  new URL("../parity-version-history-e2e.mjs", import.meta.url),
  "utf8",
);
assert.match(driver, /const \{ artifacts, contents \}/);
assert.match(driver, /contents\["02-release-detail\.txt"\]/);
assert.doesNotMatch(
  driver,
  /readFile\(`\$\{browserOut\}\/0(?:2-release-detail|2b-staging-step|3-build-log-drawer|4-staging-run-log|5-production-recovery-log|6-env-versions)\.txt/,
);
const browserSource = driver.slice(
  driver.indexOf("async function browserPass"),
);
assertInOrder(browserSource, [
  "createPinnedBrowserRunDirectory(",
  "browserTrustedRoot",
  "actions",
  "try {",
  "return await browserPassPinned(actions, directoryPin, outputNames)",
  "finally {",
  "closePinnedBrowserOutputDirectory(directoryPin)",
]);
assert.doesNotMatch(
  browserSource,
  /assertBrowserOutputDirectoryForMutation|prepareBrowserOutputFiles|rmSync\(/,
);
const pinnedSource = browserSource.slice(
  browserSource.indexOf("async function browserPassPinned"),
);
assertInOrder(pinnedSource, [
  "assertPinnedBrowserOutputDirectory(directoryPin)",
  "spawnSync(",
  "assertPinnedBrowserOutputDirectory(directoryPin)",
  "readBackBrowserArtifacts(",
  "readPinnedBrowserFile(",
]);
assert.doesNotMatch(driver, /readFile\(`\$\{browserOut\}\/cdp-evidence\.json/);

await writeFile(`${browserOut}/cdp-evidence.json`, '{"schema":"valid"}');
const cdpSnapshot = await readPinnedBrowserFile(
  directoryPin,
  "cdp-evidence.json",
);
assert.match(cdpSnapshot.buffer.toString("utf8"), /valid/);
await closePinnedBrowserOutputDirectory(directoryPin);
await rm(trustedRoot, { recursive: true });

for (const phase of ["before", "opened", "after"]) {
  await rejectsDirectorySwap(phase);
}
await rejectsBetweenChildren();
await rejectsCdpDirectorySwap();

process.stdout.write("history browser artifact self-test passed\n");

function rejects(name, mutate) {
  const metadata = structuredClone(valid);
  mutate(metadata);
  assert.equal(browserArtifactsValid(required, metadata), false, name);
}

async function rejectsReadback(mutate, changeFile = async () => {}) {
  await writeFixtures();
  const reported = structuredClone(entries);
  mutate(reported);
  await changeFile();
  await assert.rejects(
    () => readBackBrowserArtifacts(reported, directoryPin),
    /E2E_(?:ARTIFACT_(?:READBACK|CONTENT)|BROWSER_(?:FILE|DIRECTORY))_INVALID/,
  );
}

async function rejectsDirectorySwap(phase) {
  const root = await mkdtemp(join(tmpdir(), `f540-artifact-swap-${phase}-`));
  const output = join(root, "browser");
  await mkdir(join(output, "profile"), { recursive: true });
  await writeFile(join(output, names.text), buffers.text);
  const pin = await pinBrowserOutputDirectory(output, root);
  const reported = [{ text: join(output, names.text), ...valid[names.text] }];
  let swapped = false;
  try {
    await assert.rejects(
      readBackBrowserArtifacts(reported, pin, {
        parentGuard: async (event) => {
          if (!swapped && event.phase === phase) {
            swapped = true;
            await rename(output, join(root, "browser-original"));
            await mkdir(output);
          }
        },
      }),
      /E2E_BROWSER_(?:FILE|DIRECTORY)_INVALID/,
    );
  } finally {
    await closePinnedBrowserOutputDirectory(pin);
    await rm(root, { recursive: true, force: true });
  }
}

async function rejectsCdpDirectorySwap() {
  const root = await mkdtemp(join(tmpdir(), "f540-cdp-swap-"));
  const output = join(root, "browser");
  await mkdir(join(output, "profile"), { recursive: true });
  await writeFile(join(output, "cdp-evidence.json"), "{}");
  const pin = await pinBrowserOutputDirectory(output, root);
  try {
    await rename(output, join(root, "browser-original"));
    await mkdir(output);
    await assert.rejects(
      readPinnedBrowserFile(pin, "cdp-evidence.json"),
      /E2E_BROWSER_DIRECTORY_INVALID/,
    );
  } finally {
    await closePinnedBrowserOutputDirectory(pin);
    await rm(root, { recursive: true, force: true });
  }
}

async function rejectsBetweenChildren() {
  const root = await mkdtemp(join(tmpdir(), "f540-between-children-"));
  const output = join(root, "browser");
  const first = Buffer.from("first artifact snapshot");
  const second = Buffer.from("second artifact snapshot");
  await mkdir(join(output, "profile"), { recursive: true });
  await writeFile(join(output, "first.txt"), first);
  await writeFile(join(output, "second.txt"), second);
  const pin = await pinBrowserOutputDirectory(output, root);
  try {
    await assert.rejects(
      readBackBrowserArtifacts(
        [
          {
            text: join(output, "first.txt"),
            ...artifactMetadata("text", first),
          },
          {
            text: join(output, "second.txt"),
            ...artifactMetadata("text", second),
          },
        ],
        pin,
        {
          afterChild: async ({ name }) => {
            if (name !== "first.txt") return;
            await rename(output, join(root, "browser-original"));
            await mkdir(output);
          },
        },
      ),
      /E2E_BROWSER_DIRECTORY_INVALID/,
    );
  } finally {
    await closePinnedBrowserOutputDirectory(pin);
    await rm(root, { recursive: true, force: true });
  }
}

function assertInOrder(source, fragments) {
  let offset = 0;
  for (const fragment of fragments) {
    const index = source.indexOf(fragment, offset);
    assert.ok(index >= offset, `missing or out of order: ${fragment}`);
    offset = index + fragment.length;
  }
}

async function writeFixtures() {
  await Promise.all(
    Object.entries(files).map(([path, buffer]) => writeFile(path, buffer)),
  );
}
