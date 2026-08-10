import { sanitizeCdpText } from "./parity-history-cdp-redaction.mjs";

const ACTION_TYPES = new Set([
  "wait",
  "navigate",
  "setValue",
  "click",
  "waitText",
  "shot",
  "text",
  "dom",
]);
const ACTION_KEYS = {
  wait: ["index", "milliseconds", "type"],
  navigate: ["index", "target", "type"],
  setValue: ["index", "selector", "type", "valueStored"],
  click: ["index", "selector", "type"],
  waitText: ["index", "text", "type"],
  shot: ["artifact", "index", "type"],
  text: ["artifact", "index", "type"],
  dom: ["artifact", "index", "type"],
};
const TARGET_KEYS = [
  "hasFragment",
  "host",
  "pathDepth",
  "protocol",
  "queryCount",
];

export function describeCdpActions(rawActions) {
  requireAction(Array.isArray(rawActions) && rawActions.length > 0, 0, "list");
  const descriptors = rawActions.map((rawAction, index) =>
    describeAction(rawAction, index),
  );
  return validateCdpActionDescriptors(descriptors);
}

export function validateCdpActionDescriptors(actions) {
  requireAction(Array.isArray(actions) && actions.length > 0, 0, "descriptors");
  for (let index = 0; index < actions.length; index += 1) {
    requireAction(index in actions, index, "sparse");
    validateDescriptor(actions[index], index);
  }
  return actions;
}

function describeAction(rawAction, index) {
  requireAction(typeof rawAction === "string", index, "wire");
  const colon = rawAction.indexOf(":");
  requireAction(colon > 0, index, "grammar");
  const type = rawAction.slice(0, colon);
  const value = rawAction.slice(colon + 1);
  requireAction(ACTION_TYPES.has(type), index, "type");
  if (type === "wait") {
    const milliseconds = Number(value);
    requireAction(validInteger(milliseconds), index, "wait");
    return { index, type, milliseconds };
  }
  if (type === "navigate") return navigateDescriptor(value, index);
  if (type === "setValue") return setValueDescriptor(value, index);
  if (type === "click") {
    return { index, type, selector: safeText(value, index, "selector") };
  }
  if (type === "waitText") {
    return { index, type, text: safeText(value, index, "text") };
  }
  return artifactDescriptor(type, value, index);
}

function navigateDescriptor(value, index) {
  let url;
  try {
    url = new URL(value);
  } catch {
    requireAction(false, index, "navigate");
  }
  const protocol = url.protocol.toLowerCase();
  requireAction(
    protocol === "http:" || protocol === "https:",
    index,
    "protocol",
  );
  const target = {
    protocol,
    host: safeText(url.host, index, "host"),
    pathDepth: url.pathname.split("/").filter(Boolean).length,
    queryCount: [...url.searchParams].length,
    hasFragment: Boolean(url.hash),
  };
  return { index, type: "navigate", target };
}

function setValueDescriptor(value, index) {
  const separator = value.indexOf("@@@");
  requireAction(separator > 0, index, "setValue");
  const selector = safeText(value.slice(0, separator), index, "selector");
  return { index, type: "setValue", selector, valueStored: false };
}

function artifactDescriptor(type, value, index) {
  const extensions = { shot: ".png", text: ".txt", dom: ".html" };
  const artifact = safeText(value, index, "artifact");
  requireAction(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(artifact) &&
      artifact.endsWith(extensions[type]) &&
      artifact !== "." &&
      artifact !== "..",
    index,
    "artifact",
  );
  return { index, type, artifact };
}

function validateDescriptor(descriptor, index) {
  requireAction(isPlainObject(descriptor), index, "descriptor");
  requireAction(descriptor.index === index, index, "index");
  requireAction(ACTION_TYPES.has(descriptor.type), index, "type");
  requireExactKeys(descriptor, ACTION_KEYS[descriptor.type], index, "keys");
  if (descriptor.type === "wait") {
    requireAction(validInteger(descriptor.milliseconds), index, "wait");
  } else if (descriptor.type === "navigate") {
    validateTarget(descriptor.target, index);
  } else if (descriptor.type === "setValue") {
    validateSafeText(descriptor.selector, index, "selector");
    requireAction(descriptor.valueStored === false, index, "valueStored");
  } else if (descriptor.type === "click") {
    validateSafeText(descriptor.selector, index, "selector");
  } else if (descriptor.type === "waitText") {
    validateSafeText(descriptor.text, index, "text");
  } else {
    artifactDescriptor(descriptor.type, descriptor.artifact, index);
  }
}

function validateTarget(target, index) {
  requireAction(isPlainObject(target), index, "target");
  requireExactKeys(target, TARGET_KEYS, index, "targetKeys");
  requireAction(/^(?:http|https):$/.test(target.protocol), index, "protocol");
  validateSafeText(target.host, index, "host");
  requireAction(validInteger(target.pathDepth), index, "pathDepth");
  requireAction(validInteger(target.queryCount), index, "queryCount");
  requireAction(typeof target.hasFragment === "boolean", index, "fragment");
}

function safeText(value, index, label) {
  requireAction(typeof value === "string" && value.length > 0, index, label);
  return sanitizeCdpText(value).replace(/\[REDACTED\]\]*/g, "[REDACTED]");
}

function validateSafeText(value, index, label) {
  requireAction(
    typeof value === "string" &&
      value.length > 0 &&
      safeText(value, index, label) === value,
    index,
    label,
  );
}

function requireExactKeys(value, expected, index, label) {
  requireAction(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected),
    index,
    label,
  );
}

function validInteger(value) {
  return Number.isInteger(value) && value >= 0 && Number.isFinite(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireAction(value, index, reason) {
  if (!value)
    throw new Error(`E2E_CDP_ACTION_EVIDENCE_INVALID:${index}:${reason}`);
}
