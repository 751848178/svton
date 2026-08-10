export const NODE_CODE_INJECTION_ENV = Object.freeze([
  "NODE_OPTIONS",
  "NODE_PATH",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "DYLD_FRAMEWORK_PATH",
]);

export function assertTrustedNodeEnvironment(env) {
  for (const name of NODE_CODE_INJECTION_ENV) {
    if (env[name] !== undefined && env[name] !== "") {
      throw new Error(`TRUSTED_NODE_ENV_FORBIDDEN:${name}`);
    }
  }
}

export function trustedNodeChildEnvironment(env) {
  const child = { ...env };
  for (const name of NODE_CODE_INJECTION_ENV) delete child[name];
  return child;
}
