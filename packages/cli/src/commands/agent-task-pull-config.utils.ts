export function readRequired(name: string, option?: string, fallback?: string) {
  const value = readOptional(option, fallback);
  if (!value) {
    throw new Error(`Missing required task-pull option: ${name}`);
  }
  return value;
}

export function readOptional(option?: string, fallback?: string) {
  return option?.trim() || fallback?.trim() || undefined;
}

export function readCapabilities(env: NodeJS.ProcessEnv) {
  return (env.DEVPILOT_AGENT_CAPABILITIES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function readInteger(
  name: string,
  value: string | undefined,
  fallback: number,
) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid task-pull option: ${name}`);
  }
  return parsed;
}

export function readOptionalInteger(name: string, value: string | undefined) {
  if (!value) return undefined;
  const parsed = readInteger(name, value, 0);
  if (parsed <= 0) {
    throw new Error(`Invalid task-pull option: ${name}`);
  }
  return parsed;
}
