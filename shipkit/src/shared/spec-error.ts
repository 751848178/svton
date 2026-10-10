/** Field-addressed errors shared by the independent ship.yaml validators. */
export class SpecError extends Error {
  constructor(message: string, readonly field: string) {
    super(`${field}: ${message}`);
  }
}
