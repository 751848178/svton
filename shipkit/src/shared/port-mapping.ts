// One parser for spec validation, CLI defaults and runtime port selection.
export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  hostIp?: '127.0.0.1';
}

/** Keep existing forms; explicit IP bindings are limited to IPv4 loopback. */
export function parsePortMapping(value: string): PortMapping | undefined {
  const loopback = value.startsWith('127.0.0.1:');
  const input = loopback ? value.slice('127.0.0.1:'.length) : value;
  const match = /^(\d{1,5})(?::(\d{1,5}))?$/.exec(input);
  if (!match || (loopback && !match[2])) return undefined;
  const hostPort = match[2] ? Number(match[1]) : undefined;
  const containerPort = Number(match[2] ?? match[1]);
  if (containerPort < 1 || containerPort > 65535 || (hostPort !== undefined && (hostPort < 1 || hostPort > 65535))) return undefined;
  return { containerPort, ...(hostPort === undefined ? {} : { hostPort }), ...(loopback ? { hostIp: '127.0.0.1' as const } : {}) };
}
