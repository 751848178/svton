import assert from "node:assert/strict";
import test from "node:test";
import {
  PARITY_RELEASE_ACTORS,
  seedParityReleaseActors,
} from "./parity-seed-release-actors.mjs";

test("seeds three distinct login subjects with admin release permissions", async () => {
  const users = [];
  const memberships = [];
  const prisma = {
    user: { upsert: async (input) => users.push(input) },
    teamMember: { upsert: async (input) => memberships.push(input) },
  };
  const ids = {
    team: "team-1",
    user: "requester-1",
    reviewerUser: "reviewer-1",
    confirmerUser: "confirmer-1",
  };

  const receipts = await seedParityReleaseActors({
    prisma,
    ids,
    environment: {},
    hashPassword: async (value) => `hash:${value}`,
  });

  assert.equal(receipts.length, 3);
  assert.equal(new Set(receipts.map(({ userId }) => userId)).size, 3);
  assert.equal(new Set(receipts.map(({ email }) => email)).size, 3);
  assert.deepEqual(
    receipts.map(({ releaseRole }) => releaseRole),
    ["requester", "reviewer", "confirmer"],
  );
  assert.ok(users.every(({ create }) => create.passwordHash.startsWith("hash:")));
  assert.ok(memberships.every(({ create }) => create.role === "admin"));
});

test("honours a scoped credential override without merging actor identity", async () => {
  const passwords = [];
  const prisma = {
    user: { upsert: async () => undefined },
    teamMember: { upsert: async () => undefined },
  };
  await seedParityReleaseActors({
    prisma,
    ids: {
      team: "team-1",
      user: "requester-1",
      reviewerUser: "reviewer-1",
      confirmerUser: "confirmer-1",
    },
    environment: { PARITY_REVIEWER_PASSWORD: "ReviewOverride123!" },
    hashPassword: async (value) => passwords.push(value),
  });
  assert.deepEqual(passwords, [
    PARITY_RELEASE_ACTORS.requester.defaultPassword,
    "ReviewOverride123!",
    PARITY_RELEASE_ACTORS.confirmer.defaultPassword,
  ]);
});
