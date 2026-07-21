import { formatUnknownErrorMessage } from './error-message.utils';

export function formatComputerUseErrorMessage(error: unknown): string {
  return formatUnknownErrorMessage(error);
}
