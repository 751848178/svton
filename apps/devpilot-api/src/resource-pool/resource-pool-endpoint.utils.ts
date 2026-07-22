/**
 * Pure endpoint parser for resource pools.
 *
 * Accepts `host:port`, `tcp://host:port`, `mysql://host:port`, etc. Returns a
 * normalized `{ host, port }`. Extracted from `resource-pool-provisioning.service.ts`
 * so it can be unit-tested and reused by the mysql/redis provisioning utils
 * without a NestJS dependency.
 */
export function parseResourceEndpoint(
  endpoint: string,
  defaultPort: number,
): { host: string; port: number } {
  try {
    const normalized = endpoint.includes("://") ? endpoint : `tcp://${endpoint}`;
    const url = new URL(normalized);
    return {
      host: url.hostname || endpoint,
      port: url.port ? Number(url.port) : defaultPort,
    };
  } catch {
    const [host, port] = endpoint.split(":");
    return {
      host: host || endpoint,
      port: port ? Number(port) : defaultPort,
    };
  }
}
