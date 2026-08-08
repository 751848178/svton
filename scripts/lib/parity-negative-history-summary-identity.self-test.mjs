#!/usr/bin/env node
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import { historyAnchorFixture } from "./parity-negative-history-staging-fixture.mjs";
import { rejectIdentity } from "./parity-negative-history-identity-test-support.mjs";
import { validateHistorySummary } from "./parity-negative-history-summary-identity.mjs";

const document = historyDocumentFixture();
const anchors = historyAnchorFixture(document.context);
validateHistorySummary(document.steps, anchors);

const booleansFalse = historyDocumentFixture();
const summary = booleansFalse.steps["version-chains"].result;
summary.staging.chainLinksValid = false;
summary.staging.expectedKinds = ["junk"];
summary.production.chainLinksValid = false;
summary.production.expectedKinds = ["junk"];
validateHistorySummary(booleansFalse.steps, anchors);

for (const [label, mutate] of [
  ["malformed prefix", (chain) => chain.unshift({ id: "claimed" })],
  [
    "well-formed extra prefix",
    (chain) =>
      chain.unshift({
        id: "claimed-version",
        kind: "upgrade",
        prev: "claimed-prev",
        manifest: "claimed-manifest",
      }),
  ],
  [
    "extra suffix",
    (chain) =>
      chain.push({
        id: "claimed-version",
        kind: "upgrade",
        prev: "claimed-prev",
        manifest: "claimed-manifest",
      }),
  ],
  ["duplicate Vprod1", (chain) => chain.unshift({ ...chain[0] })],
  ["wrong root prev", (chain) => (chain[0].prev = "claimed")],
  ["wrong Vprod2 prev", (chain) => (chain[1].prev = "claimed")],
  ["wrong Vprod3 prev", (chain) => (chain[2].prev = "claimed")],
  ["wrong kind", (chain) => (chain[1].kind = "recovery")],
  ["wrong manifest", (chain) => (chain[2].manifest = "claimed-manifest")],
  ["wrong id", (chain) => (chain[0].id = "claimed-version")],
  ["missing row", (chain) => chain.splice(1, 1)],
  ["reordered rows", (chain) => ([chain[1], chain[2]] = [chain[2], chain[1]])],
]) {
  rejectIdentity(`production chain: ${label}`, (value) =>
    mutate(value.steps["version-chains"].result.production.chain),
  );
}

for (const [label, mutate] of [
  [
    "staging extra prefix",
    (chain) =>
      chain.unshift({
        id: "claimed-version",
        kind: "deploy",
        prev: "claimed-prev",
        manifest: "claimed-manifest",
      }),
  ],
  ["staging wrong root prev", (chain) => (chain[0].prev = "claimed")],
  [
    "staging reordered rows",
    (chain) => ([chain[2], chain[3]] = [chain[3], chain[2]]),
  ],
]) {
  rejectIdentity(`staging chain: ${label}`, (value) =>
    mutate(value.steps["version-chains"].result.staging.chain),
  );
}

process.stdout.write("negative history summary identity self-test passed\n");
