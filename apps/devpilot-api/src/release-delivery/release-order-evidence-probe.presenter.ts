export function presentSiteProbe(result: unknown) {
  const siteProbe = recordValue(recordValue(result).siteProbe);
  if (Object.keys(siteProbe).length === 0) return null;
  const dns = recordValue(siteProbe.dns);
  const tls = recordValue(siteProbe.tls);
  const http = recordValue(siteProbe.http);
  return {
    version: numberValue(siteProbe.version),
    primaryDomain: stringValue(siteProbe.primaryDomain),
    finalUrl: stringValue(siteProbe.finalUrl),
    probedAt: stringValue(siteProbe.probedAt),
    dns: {
      status: stringValue(dns.status), hostname: stringValue(dns.hostname),
      records: arrayOfStrings(dns.records), error: presentProbeError(dns.error),
      checkedAt: stringValue(dns.checkedAt),
    },
    tls: {
      status: stringValue(tls.status), host: stringValue(tls.host),
      port: numberValue(tls.port), servername: stringValue(tls.servername),
      cert: presentProbeTlsCert(tls.cert), error: presentProbeError(tls.error),
      checkedAt: stringValue(tls.checkedAt),
    },
    http: {
      status: stringValue(http.status), url: stringValue(http.url),
      finalUrl: stringValue(http.finalUrl), statusCode: numberValue(http.statusCode),
      bodySignature: stringValue(http.bodySignature),
      error: presentProbeError(http.error), checkedAt: stringValue(http.checkedAt),
    },
  };
}

export function presentRouteSwitch(result: unknown) {
  const routeSwitch = recordValue(recordValue(result).routeSwitch);
  if (Object.keys(routeSwitch).length === 0) return null;
  return {
    version: numberValue(routeSwitch.version), siteId: stringValue(routeSwitch.siteId),
    primaryDomain: stringValue(routeSwitch.primaryDomain),
    deploymentRunId: stringValue(routeSwitch.deploymentRunId),
    releaseRunId: stringValue(routeSwitch.releaseRunId),
    targetRef: stringValue(routeSwitch.targetRef),
    proxyTarget: stringValue(routeSwitch.proxyTarget),
    domains: arrayOfStrings(routeSwitch.domains), status: stringValue(routeSwitch.status),
    reasonCode: stringValue(routeSwitch.reasonCode),
    switchedAt: stringValue(routeSwitch.switchedAt),
  };
}

function presentProbeTlsCert(cert: unknown) {
  const value = recordValue(cert);
  if (Object.keys(value).length === 0) return null;
  return {
    subject: stringValue(value.subject), issuer: stringValue(value.issuer),
    validFrom: stringValue(value.validFrom), validUntil: stringValue(value.validUntil),
    expired: booleanValue(value.expired),
  };
}

function presentProbeError(error: unknown) {
  const value = recordValue(error);
  if (Object.keys(value).length === 0) return null;
  return { code: stringValue(value.code), message: stringValue(value.message) };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string") : null;
}
