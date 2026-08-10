export function requestRouteHostname(request) {
  try {
    return new URL(`http://${request.headers.host || ""}`).hostname;
  } catch {
    return "";
  }
}

export function validRouteDomains(domains, primaryDomain) {
  return (
    Array.isArray(domains) &&
    domains.length > 0 &&
    domains.every(canonicalDomain) &&
    domains.includes(primaryDomain)
  );
}

function canonicalDomain(value) {
  try {
    const parsed = new URL(`http://${value}`);
    return (
      typeof value === "string" &&
      value.length <= 253 &&
      parsed.hostname === value &&
      parsed.host === value
    );
  } catch {
    return false;
  }
}
