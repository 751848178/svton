export const CDP_SESSION_SCHEMA = "devpilot.parity-history.cdp-session";
export const CDP_SESSION_VERSION = 1;

const KEYS = Object.freeze([
  "browserTargetId",
  "chromePid",
  "pageTargetId",
  "port",
  "product",
  "profile",
  "protocolVersion",
  "schema",
  "version",
]);

export function cdpSessionIdentity(values) {
  return validateCdpSessionIdentity({
    schema: CDP_SESSION_SCHEMA,
    version: CDP_SESSION_VERSION,
    ...values,
  });
}

export function validateCdpSessionIdentity(identity) {
  requireValue(isRecord(identity), "record");
  requireValue(
    JSON.stringify(Object.keys(identity).sort()) === JSON.stringify(KEYS),
    "keys",
  );
  requireValue(identity.schema === CDP_SESSION_SCHEMA, "schema");
  requireValue(identity.version === CDP_SESSION_VERSION, "version");
  requireValue(
    Number.isInteger(identity.chromePid) && identity.chromePid > 1,
    "pid",
  );
  requireValue(
    Number.isInteger(identity.port) &&
      identity.port >= 1024 &&
      identity.port <= 65535,
    "port",
  );
  requireValue(validId(identity.browserTargetId), "browser-target");
  requireValue(validId(identity.pageTargetId), "page-target");
  requireValue(
    identity.browserTargetId !== identity.pageTargetId,
    "distinct-targets",
  );
  requireValue(validText(identity.product), "product");
  requireValue(validText(identity.protocolVersion), "protocol-version");
  requireValue(isRecord(identity.profile), "profile");
  requireValue(
    Object.keys(identity.profile).sort().join(",") === "dev,ino",
    "profile-keys",
  );
  requireValue(/^\d+$/.test(identity.profile.dev), "profile-dev");
  requireValue(/^\d+$/.test(identity.profile.ino), "profile-ino");
  return identity;
}

function validId(value) {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,128}$/.test(value);
}

function validText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function requireValue(value, reason) {
  if (!value) throw new Error(`E2E_CDP_SESSION_INVALID:${reason}`);
}
