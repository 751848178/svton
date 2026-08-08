import { HISTORY_RESULT_KEY_INVENTORY } from "./parity-negative-history-result-key-inventory.mjs";

export function validateHistoryResultKeys(steps) {
  for (const [name, expectedKeys] of Object.entries(
    HISTORY_RESULT_KEY_INVENTORY,
  )) {
    const result = steps?.[name]?.result;
    if (
      result === null ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      throw new Error(`history result keys invalid: ${name} not an object`);
    }
    const actual = Object.keys(result).sort();
    if (
      actual.length !== expectedKeys.length ||
      actual.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new Error(`history result keys invalid: ${name}`);
    }
  }
}
