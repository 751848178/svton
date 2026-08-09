#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [dockerignore, dockerfile, parityCompose, appCompose] = await Promise.all(
  [
    readFile(new URL("../../.dockerignore", import.meta.url), "utf8"),
    readFile(
      new URL("../../apps/devpilot-web/Dockerfile", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../docker-compose.devpilot-parity.yml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../docker-compose.devpilot-app.yml", import.meta.url),
      "utf8",
    ),
  ],
);
assert.match(dockerignore, /^\*\*\/\.next$/m);
assert.doesNotMatch(dockerignore, /^!.*\.next/m);

const webStage = dockerfile.slice(dockerfile.indexOf("FROM base AS web"));
assert.ok(webStage.startsWith("FROM base AS web"));
assert.match(webStage, /ENV NEXT_TELEMETRY_DISABLED=1/);
assert.match(webStage, /ARG NEXT_PUBLIC_API_URL/);
assert.match(webStage, /COPY --from=web-dist \. \.next\//);
assert.match(
  webStage,
  /RUN test -n "\$NEXT_PUBLIC_API_URL" && test -f \.next\/BUILD_ID/,
);
assert.doesNotMatch(webStage, /compiled on the host/i);
assert.match(
  parityCompose,
  /additional_contexts:\n\s+web-dist: \$\{PARITY_WEB_DIST_ROOT:-\.\/apps\/devpilot-web\/\.next\}/,
);
assert.match(
  appCompose,
  /additional_contexts:\n\s+web-dist: \.\/apps\/devpilot-web\/\.next/,
);
process.stdout.write("parity Web image build contract self-test passed\n");
