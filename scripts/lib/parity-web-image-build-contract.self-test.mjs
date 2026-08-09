#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [dockerignore, dockerfile] = await Promise.all([
  readFile(new URL("../../.dockerignore", import.meta.url), "utf8"),
  readFile(
    new URL("../../apps/devpilot-web/Dockerfile", import.meta.url),
    "utf8",
  ),
]);
assert.match(dockerignore, /^\*\*\/\.next$/m);
assert.doesNotMatch(dockerignore, /^!.*\.next/m);

const webStage = dockerfile.slice(dockerfile.indexOf("FROM base AS web"));
assert.ok(webStage.startsWith("FROM base AS web"));
assert.match(webStage, /ENV NEXT_TELEMETRY_DISABLED=1/);
assert.ok(webStage.indexOf("RUN pnpm build") < webStage.indexOf("CMD ["));
assert.doesNotMatch(webStage, /compiled on the host/i);
process.stdout.write("parity Web image build contract self-test passed\n");
