export function applicationServicePorts(
  ports: unknown,
  deployConfig: unknown,
): number[] {
  const config = record(deployConfig);
  return [...new Set([ports, config.ports, config.port].flatMap(readPorts))];
}

function readPorts(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(readPorts);
  if (typeof value === "number") return validPort(value) ? [value] : [];
  if (typeof value === "string") {
    const port = Number(value.includes(":") ? value.split(":").at(-1) : value);
    return validPort(port) ? [port] : [];
  }
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return readPorts(item.target ?? item.containerPort ?? item.port);
  }
  return [];
}

function validPort(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 65_535;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
