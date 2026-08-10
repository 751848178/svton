import { describe, expect, it } from "vitest";
import {
  clearGeneratedProjectAttempt,
  getGeneratedProjectAttempt,
} from "./generated-project-attempt-key";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("generated project attempt key", () => {
  it("reuses one key for the same payload across helper instances", () => {
    const storage = createStorage();
    let calls = 0;
    const randomUUID = () => `attempt-${++calls}`;

    const first = getGeneratedProjectAttempt(storage, randomUUID, {
      basicInfo: { name: "demo" },
      features: ["auth"],
    });
    const repeated = getGeneratedProjectAttempt(storage, randomUUID, {
      features: ["auth"],
      basicInfo: { name: "demo" },
    });

    expect(repeated.key).toBe(first.key);
    expect(calls).toBe(1);
  });

  it("rotates the key when payload content changes", () => {
    const storage = createStorage();
    let calls = 0;
    const randomUUID = () => `attempt-${++calls}`;

    getGeneratedProjectAttempt(storage, randomUUID, { name: "first" });
    const changed = getGeneratedProjectAttempt(storage, randomUUID, {
      name: "second",
    });

    expect(changed.key).toBe("attempt-2");
  });

  it("clears only the confirmed successful attempt", () => {
    const storage = createStorage();
    getGeneratedProjectAttempt(storage, () => "attempt-1", { name: "demo" });

    clearGeneratedProjectAttempt(storage, "other-attempt");
    expect(getGeneratedProjectAttempt(storage, () => "attempt-2", { name: "demo" }).key)
      .toBe("attempt-1");
    clearGeneratedProjectAttempt(storage, "attempt-1");
    expect(getGeneratedProjectAttempt(storage, () => "attempt-2", { name: "demo" }).key)
      .toBe("attempt-2");
  });
});
