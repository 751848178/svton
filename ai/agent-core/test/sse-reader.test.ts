import { describe, it, expect, vi } from 'vitest';
import { readSSELines } from '../src/provider/sse-reader';

function createSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream);
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

describe('readSSELines', () => {
  it('yields data lines from single chunk', async () => {
    const response = createSSEResponse(['data: hello\n\n']);
    const lines = await collect(readSSELines(response));
    expect(lines).toEqual(['hello']);
  });

  it('yields from multiple chunks', async () => {
    const response = createSSEResponse([
      'data: first\n\n',
      'data: second\n\n',
      'data: third\n\n',
    ]);
    const lines = await collect(readSSELines(response));
    expect(lines).toEqual(['first', 'second', 'third']);
  });

  it('skips comment lines (starting with :)', async () => {
    const response = createSSEResponse([
      ': this is a comment\n\ndata: hello\n\n',
    ]);
    const lines = await collect(readSSELines(response));
    expect(lines).toEqual(['hello']);
  });

  it('skips empty lines', async () => {
    const response = createSSEResponse([
      '\n\ndata: hello\n\n\n\ndata: world\n\n',
    ]);
    const lines = await collect(readSSELines(response));
    expect(lines).toEqual(['hello', 'world']);
  });

  it('skips non-data lines', async () => {
    const response = createSSEResponse([
      'event: message\nid: 123\ndata: payload\n\n',
    ]);
    const lines = await collect(readSSELines(response));
    expect(lines).toEqual(['payload']);
  });

  it('handles partial lines across chunks (buffer continuation)', async () => {
    const response = createSSEResponse([
      'data: hel',
      'lo world\n\n',
    ]);
    const lines = await collect(readSSELines(response));
    expect(lines).toEqual(['hello world']);
  });

  it('handles empty response', async () => {
    const response = createSSEResponse([]);
    const lines = await collect(readSSELines(response));
    expect(lines).toEqual([]);
  });

  it('calls releaseLock on the reader', async () => {
    const response = createSSEResponse(['data: hello\n\n']);
    const reader = response.body!.getReader();
    const releaseSpy = vi.spyOn(reader, 'releaseLock');
    // We need to re-create so we can spy before consumption.
    // Create a fresh response and spy on its reader's releaseLock.
    const response2 = createSSEResponse(['data: hello\n\n']);
    const originalGetReader = response2.body!.getReader.bind(response2.body!);
    let capturedReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    response2.body!.getReader = () => {
      capturedReader = originalGetReader();
      const origRelease = capturedReader.releaseLock.bind(capturedReader);
      const spy = vi.fn(origRelease);
      capturedReader.releaseLock = spy;
      return capturedReader as ReadableStreamDefaultReader<Uint8Array>;
    };

    await collect(readSSELines(response2));
    expect(capturedReader!.releaseLock).toHaveBeenCalled();
  });
});
