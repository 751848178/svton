#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const provider = await readFile(
  new URL("../parity-route-control-provider.mjs", import.meta.url),
  "utf8",
);
const dockerfile = await readFile(
  new URL("../parity-route-control.Dockerfile", import.meta.url),
  "utf8",
);

for (const helper of [
  "parity-route-control-domain.mjs",
  "parity-route-control-upstream.mjs",
]) {
  assert.match(provider, new RegExp(`\\./lib/${helper}`));
  assert.match(
    dockerfile,
    new RegExp(`COPY scripts/lib/${helper} /app/lib/${helper}`),
    `route-control image must package ${helper}`,
  );
}

process.stdout.write("route-control image contract self-test passed\n");
