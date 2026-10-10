type RegistrationProtocol = typeof import('shipkit/platform');

let registrationProtocol: Promise<RegistrationProtocol> | undefined;

/** Preserve the API's CommonJS boundary when loading Shipkit's ESM protocol. */
export function loadRegistrationProtocol(): Promise<RegistrationProtocol> {
  return registrationProtocol ??= import('shipkit/platform');
}
