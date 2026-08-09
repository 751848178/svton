#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  describeCdpActions,
  validateCdpActionDescriptors,
} from "./parity-history-cdp-action-evidence.mjs";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
  validateCdpEvidence,
} from "./parity-history-cdp-capture.mjs";
import { cdpSessionFixture } from "./parity-history-cdp-session.fixture.mjs";

const password = "F547-PASSWORD-SECRET@@@tail";
const navigation =
  "https://alice:pw@example.test/reset/opaque?token=F547-NAV-TOKEN&safe=yes#F547-FRAGMENT";
const rawActions = [
  "wait:25",
  `navigate:${navigation}`,
  `setValue:input[type=password]@@@${password}`,
  'click:button[data-authorization="Bearer F547-CLICK-SECRET"]',
  "waitText:token=F547-TEXT-SECRET",
  "shot:proof.png",
  "text:proof.txt",
  "dom:proof.html",
];
const actions = describeCdpActions(rawActions);
assert.deepEqual(
  actions.map(({ index, type }) => ({ index, type })),
  [
    "wait",
    "navigate",
    "setValue",
    "click",
    "waitText",
    "shot",
    "text",
    "dom",
  ].map((type, index) => ({ index, type })),
);
assert.deepEqual(actions[1], {
  index: 1,
  type: "navigate",
  target: {
    protocol: "https:",
    host: "example.test",
    pathDepth: 2,
    queryCount: 2,
    hasFragment: true,
  },
});
for (const forbidden of ["alice", "pw", "opaque", "token", "safe", "yes"]) {
  assert.doesNotMatch(JSON.stringify(actions[1]), new RegExp(forbidden, "i"));
}
assert.deepEqual(actions[2], {
  index: 2,
  type: "setValue",
  selector: "input[type=password]",
  valueStored: false,
});
const persisted = JSON.stringify(actions);
for (const secret of [
  "alice",
  "pw",
  "opaque",
  "F547-NAV-TOKEN",
  "yes",
  "F547-FRAGMENT",
  "F547-PASSWORD-SECRET",
  "tail",
  "F547-CLICK-SECRET",
  "F547-TEXT-SECRET",
]) {
  assert.doesNotMatch(persisted, new RegExp(secret, "i"), secret);
}
const safeText = describeCdpActions([
  "waitText:tokenizer secretary passwordless",
])[0].text;
assert.equal(safeText, "tokenizer secretary passwordless");
assert.strictEqual(validateCdpActionDescriptors(actions), actions);

const valid = evidenceFixture(actions);
assert.strictEqual(validateCdpEvidence(valid), valid);
rejectEvidence((value) => (value.version = 1));
rejectEvidence((value) => delete value.actions);
rejectEvidence((value) => (value.actions = []));
rejectEvidence((value) => (value.actions = rawActions));
rejectEvidence((value) => (value.actions = new Array(1)));
rejectEvidence((value) => (value.rawActions = rawActions));
rejectAction((value) => (value[0].index = 7));
rejectAction((value) => (value[0].type = "unsupported"));
rejectAction((value) => (value[0].extra = true));
rejectAction((value) => (value[0].milliseconds = Number.POSITIVE_INFINITY));
for (const field of ["value", "input", "raw", "length", "sha256", "preview"]) {
  rejectAction((value) => (value[2][field] = "F547-FORBIDDEN"));
}
for (const field of [
  "url",
  "pathname",
  "query",
  "queryKeys",
  "queryValues",
  "userinfo",
  "fragment",
]) {
  rejectAction((value) => (value[1].target[field] = "F547-FORBIDDEN"));
}
rejectAction((value) => (value[1].target = "https://secret"));
rejectAction((value) => (value[1].target.queryCount = "2"));
rejectAction((value) => (value[2].valueStored = true));
assert.throws(() => describeCdpActions([]), /E2E_CDP_ACTION_EVIDENCE_INVALID/);
assert.throws(
  () => describeCdpActions(["setValue:input@@@F547-ERROR-SECRET", "bad:F547"]),
  (error) => !String(error).includes("F547-ERROR-SECRET"),
);

const driverSource = await readFile(
  new URL("./parity-history-cdp-driver.mjs", import.meta.url),
  "utf8",
);
const actionSource = await readFile(
  new URL("./parity-history-cdp-actions.mjs", import.meta.url),
  "utf8",
);
assert.match(driverSource, /runCdpActions\(cdp, rawActions, options\)/);
assert.match(driverSource, /capture\.snapshot\(actionDescriptors\)/);
assert.doesNotMatch(driverSource, /actions\s*:\s*rawActions/);
assert.doesNotMatch(driverSource, /JSON\.stringify\([^)]*rawActions/);
assert.doesNotMatch(driverSource, /error\.stack/);
assert.doesNotMatch(actionSource, /selector not found:|text not found:/);
assert.doesNotMatch(actionSource, /\$\{action\}|\$\{selector\}|\$\{text\}/);

process.stdout.write("history CDP action evidence self-test passed\n");

function evidenceFixture(descriptors) {
  return {
    schema: CDP_EVIDENCE_SCHEMA,
    version: CDP_EVIDENCE_VERSION,
    session: cdpSessionFixture(),
    actions: structuredClone(descriptors),
    viewport: { width: 100, height: 100 },
    console: [],
    runtimeExceptions: [],
    failedRequests: [],
    httpResponses: [
      {
        requestId: "document-200",
        url: "https://example.test/",
        host: "example.test",
        type: "Document",
        status: 200,
      },
    ],
  };
}

function rejectEvidence(mutate) {
  const evidence = evidenceFixture(actions);
  mutate(evidence);
  assert.throws(
    () => validateCdpEvidence(evidence),
    /E2E_CDP_EVIDENCE_SCHEMA_INVALID/,
  );
}

function rejectAction(mutate) {
  rejectEvidence((evidence) => mutate(evidence.actions));
}
