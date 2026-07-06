import { SseFrameWriter } from './sse-frame-writer';

/** Fake writable：收集 write 调用。 */
function createFakeWritable() {
  const chunks: string[] = [];
  return {
    chunks,
    writableEnded: false,
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
  };
}

describe('SseFrameWriter', () => {
  it('writes a complete event frame with id/event/data/retry', () => {
    const w = createFakeWritable();
    const writer = new SseFrameWriter(w as never);

    writer.write({
      event: 'entries',
      data: { entries: [{ id: '1' }] },
      id: 'cursor-1',
      retryMs: 3000,
    });

    const output = w.chunks.join('');
    expect(output).toContain('id: cursor-1\n');
    expect(output).toContain('retry: 3000\n');
    expect(output).toContain('event: entries\n');
    expect(output).toContain('data: {"entries":[{"id":"1"}]}\n');
    expect(output.endsWith('\n')).toBe(true); // 帧末尾空行
  });

  it('omits id/retry lines when not provided', () => {
    const w = createFakeWritable();
    const writer = new SseFrameWriter(w as never);

    writer.write({ event: 'message', data: 'hello' });

    const output = w.chunks.join('');
    expect(output).not.toContain('id:');
    expect(output).not.toContain('retry:');
    expect(output).toContain('event: message\n');
    expect(output).toContain('data: hello\n');
  });

  it('handles multi-line string data (each line prefixed with data:)', () => {
    const w = createFakeWritable();
    const writer = new SseFrameWriter(w as never);

    writer.write({ data: 'line1\nline2' });

    const output = w.chunks.join('');
    expect(output).toContain('data: line1\ndata: line2\n');
  });

  it('returns false when writable has ended', () => {
    const w = { ...createFakeWritable(), writableEnded: true };
    const writer = new SseFrameWriter(w as never);

    const result = writer.write({ data: 'x' });
    expect(result).toBe(false);
    expect(w.chunks).toHaveLength(0);
  });

  it('writeComment produces a heartbeat comment line', () => {
    const w = createFakeWritable();
    const writer = new SseFrameWriter(w as never);

    writer.writeComment('ping');
    expect(w.chunks.join('')).toBe(': ping\n\n');
  });

  it('active reflects writable state', () => {
    const w = createFakeWritable();
    const writer = new SseFrameWriter(w as never);
    expect(writer.active).toBe(true);

    w.writableEnded = true;
    expect(writer.active).toBe(false);
  });
});
