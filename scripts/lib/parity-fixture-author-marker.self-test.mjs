import assert from "node:assert/strict";
import test from "node:test";
import {
  isCurrentParityFixtureMarker,
  parityFixtureGitEnvironment,
  parityFixtureMarker,
} from "./parity-fixture-author-marker.mjs";

test("fixture marker binds the deterministic commit to a login-capable actor", () => {
  const actor = { name: "Parity Production Confirmer", email: "confirmer@example.test" };
  const env = parityFixtureGitEnvironment(actor, "2026-08-11T00:00:00Z", {});
  const marker = parityFixtureMarker({
    pinnedCommit: "a".repeat(40), commitAuthorEmail: env.GIT_AUTHOR_EMAIL,
    source: "/fixture", materializedAt: "2026-08-11T00:00:00Z",
  });
  assert.equal(isCurrentParityFixtureMarker(marker, actor.email), true);
  assert.equal(isCurrentParityFixtureMarker({ ...marker, commitAuthorEmail: "stale" },
    actor.email), false);
  assert.equal(env.GIT_AUTHOR_EMAIL, env.GIT_COMMITTER_EMAIL);
});
