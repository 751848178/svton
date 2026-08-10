const hasOwn = Object.prototype.hasOwnProperty;

export function httpExceptionPublicData(
  response: Record<string, unknown>,
): unknown {
  if (!hasOwn.call(response, "publicData")) return null;
  return response.publicData === undefined ? null : response.publicData;
}
