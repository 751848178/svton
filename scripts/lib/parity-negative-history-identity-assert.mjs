export function historyResult(steps, name) {
  const result = steps?.[name]?.result;
  requireIdentity(isPlainObject(result), `${name}:result`);
  return result;
}

export function requireIdentity(value, label) {
  if (!value) throw new Error(`history identity invalid: ${label}`);
}

export function requireEqual(actual, expected, label) {
  requireIdentity(sameJson(actual, expected), label);
}

export function requireDistinct(values, label) {
  requireIdentity(values.every(nonEmpty), `${label}:empty`);
  requireIdentity(new Set(values).size === values.length, `${label}:duplicate`);
}

export function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validDigest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(value || "");
}

export function validTime(value) {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

export function freezeIdentity(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeIdentity);
  return Object.freeze(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
