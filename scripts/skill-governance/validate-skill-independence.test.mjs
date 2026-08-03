import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateSkillIndependence } from "./validate-skill-independence.mjs";

async function createSkill(root, name, body, reference) {
  const packageDir = path.join(root, name);
  await mkdir(path.join(packageDir, "references"), { recursive: true });
  await writeFile(
    path.join(packageDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: test\n---\n\n${body}\n`,
  );
  if (reference) {
    await writeFile(
      path.join(packageDir, "references", "details.md"),
      reference,
    );
  }
}

test("accepts standalone packages with internal references", async (t) => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "skill-independence-good-"),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  await createSkill(
    root,
    "alpha",
    "[Details](references/details.md)",
    "Local only.",
  );

  const result = await validateSkillIndependence(root);

  assert.equal(result.status, "passed");
  assert.deepEqual(result.issues, []);
});

test("rejects a named dependency on another package", async (t) => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "skill-independence-cross-"),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  await createSkill(root, "alpha", "Requires beta before execution.");
  await createSkill(root, "beta", "Runs independently.");

  const result = await validateSkillIndependence(root);

  assert.equal(result.status, "failed");
  assert.deepEqual(result.issues, [
    {
      type: "cross_skill_name",
      package: "alpha",
      dependency: "beta",
      file: "alpha/SKILL.md",
    },
  ]);
});
