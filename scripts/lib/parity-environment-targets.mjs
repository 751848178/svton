export function requireEnvironmentTargets(response) {
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.providerKey !== "string" ||
    !response.currentTarget ||
    typeof response.currentTarget !== "object" ||
    !Array.isArray(response.bindings)
  ) {
    throw targetError("schema");
  }
  const current = response.currentTarget;
  if (
    current.providerKey !== response.providerKey ||
    typeof current.targetRef !== "string" ||
    current.targetRef.length === 0 ||
    response.bindings.filter(
      ({ id, providerKey }) =>
        id === current.bindingId && providerKey === response.providerKey,
    ).length !== 1
  ) {
    throw targetError("binding");
  }
  return Object.freeze({ current, bindings: response.bindings });
}

function targetError(reason) {
  return new Error(`PARITY_ENVIRONMENT_TARGETS_INVALID: ${reason}`);
}
