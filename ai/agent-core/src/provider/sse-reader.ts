/**
 * Generic SSE line reader for streaming HTTP responses.
 *
 * Handles the common pattern of reading chunks from a ReadableStream,
 * splitting on newlines, and yielding parsed `data:` lines.
 * Skips comments (lines starting with `:`) and empty lines.
 *
 * Consumers handle event-type-specific parsing themselves.
 */
export async function* readSSELines(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data: ')) continue;

        yield trimmed.slice(6);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
