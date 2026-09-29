// CLI-level error carrying a stable process exit code (documented for AI/tooling consumers).

export class CliError extends Error {
  constructor(message: string, readonly exitCode = 2) {
    super(message);
  }
}
