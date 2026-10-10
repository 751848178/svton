import { parseRegistrationInput, registrationFault } from './fault.js';
import { loadRegistrationProtocol } from './protocol.js';

function exactBody(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) registrationFault('REGISTRATION_INPUT_INVALID');
  const prototype = Object.getPrototypeOf(body), value = body as Record<string, unknown>;
  if ((prototype !== Object.prototype && prototype !== null) || Reflect.ownKeys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key)) || value.v !== 1) registrationFault('REGISTRATION_INPUT_INVALID');
  return value;
}
export async function registeredAgentId(id: unknown): Promise<string> {
  return parseRegistrationInput((await loadRegistrationProtocol()).parseRegistrationIdentity, id);
}
export async function controlInput(body: unknown, field?: 'disabled' | 'draining') {
  const value = exactBody(body, ['v', 'expectedTrustRevision', ...(field ? [field] : [])]);
  const { parseRegistrationCounter } = await loadRegistrationProtocol();
  const expectedTrustRevision = parseRegistrationInput(parseRegistrationCounter, value.expectedTrustRevision);
  if (field && typeof value[field] !== 'boolean') registrationFault('REGISTRATION_INPUT_INVALID');
  return { expectedTrustRevision, value: field ? value[field] as boolean : undefined };
}
export async function rotateInput(body: unknown) {
  const value = exactBody(body, ['v', 'expectedTrustRevision', 'expectedCredentialRevision', 'newCredential']);
  const { parseRegistrationCounter, parseMachineSecret } = await loadRegistrationProtocol();
  return { expectedTrustRevision: parseRegistrationInput(parseRegistrationCounter, value.expectedTrustRevision),
    expectedCredentialRevision: parseRegistrationInput(parseRegistrationCounter, value.expectedCredentialRevision),
    newCredential: parseRegistrationInput(parseMachineSecret, value.newCredential) };
}
export function enrollmentRevokeInput(body: unknown): void { exactBody(body, ['v']); }
