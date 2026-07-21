import { formatUnknownErrorMessage } from '../utils/error-message.utils';

export function toRuntimeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(formatUnknownErrorMessage(error));
}
