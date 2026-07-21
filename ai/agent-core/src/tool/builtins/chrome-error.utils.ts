import { formatUnknownErrorMessage } from './error-message.utils';

export function formatChromeErrorMessage(error: unknown): string {
  return formatUnknownErrorMessage(error);
}
