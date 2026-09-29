// Transport-level error thrown by route handlers; rendered as a JSON error envelope.

export class HttpFail extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
