export function normalizeRouteControlTarget(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("invalid_proxy_target");
  }
  const target = value.trim();
  try {
    const url = new URL(target);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("invalid_proxy_target");
    }
    return url.toString();
  } catch (error) {
    if (error?.message === "invalid_proxy_target") throw error;
  }
  const match = target.match(/^([a-zA-Z0-9@._/-]{1,480}):([0-9]{1,5})$/);
  const port = Number(match?.[2]);
  if (!match || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("invalid_proxy_target");
  }
  return target;
}

export function parseRouteControlUpstreamMap(value) {
  if (!value) return Object.freeze({});
  let parsed;
  try { parsed = JSON.parse(value); }
  catch { throw new Error("upstream_map_invalid"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("upstream_map_invalid");
  }
  const entries = Object.entries(parsed).map(([key, target]) => {
    const normalizedKey = normalizeRouteControlTarget(key);
    const normalizedTarget = normalizeRouteControlTarget(target);
    if (!/^https?:\/\//.test(normalizedTarget)) throw new Error("upstream_map_invalid");
    return [normalizedKey, normalizedTarget];
  });
  return Object.freeze(Object.fromEntries(entries));
}

export function resolveRouteControlUpstream(value, upstreamMap = {}) {
  const target = normalizeRouteControlTarget(value);
  if (/^https?:\/\//.test(target)) return target;
  const mapped = upstreamMap[target];
  if (!mapped) {
    throw Object.assign(new Error("proxy_target_unavailable"), { statusCode: 502 });
  }
  return mapped;
}
