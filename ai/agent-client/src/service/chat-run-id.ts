let fallbackSequence = 0;

/** Creates one opaque id which remains stable for the lifetime of a run. */
export function createChatRunId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUuid) return `run_${randomUuid()}`;
  fallbackSequence = (fallbackSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `run_${Date.now().toString(36)}_${fallbackSequence.toString(36)}`;
}
