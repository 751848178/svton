import assert from "node:assert/strict";
import { retirePositiveSeedProject } from "./parity-positive-delivery-fixture-claim.mjs";

const deletions = [];
const prisma = {
  project: {
    deleteMany(input) {
      deletions.push(input);
      return Promise.resolve({ count: 1 });
    },
  },
};

assert.deepEqual(
  await retirePositiveSeedProject(prisma, "fresh-project-0001"),
  { count: 1 },
);
assert.deepEqual(deletions, [{ where: { id: "parity-project-0001" } }]);
assert.deepEqual(
  await retirePositiveSeedProject(prisma, "parity-project-0001"),
  { count: 0 },
);
assert.equal(deletions.length, 1);

process.stdout.write("positive delivery fixture claim self-test passed\n");
