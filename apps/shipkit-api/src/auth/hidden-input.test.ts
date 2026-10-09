import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import type { ReadStream, WriteStream } from 'node:tty';
import { hiddenInput } from './hidden-input.js';
import { adminCli } from './admin-cli.js';

function terminal() {
  const input = new PassThrough() as unknown as ReadStream, output = new PassThrough() as unknown as WriteStream;
  input.isTTY = true; output.isTTY = true; input.isRaw = false;
  input.setRawMode = (mode) => { input.isRaw = mode; return input; };
  let displayed = ''; output.on('data', (chunk) => { displayed += chunk.toString(); });
  return { input, output, displayed: () => displayed };
}
test('hidden input never echoes a password and restores terminal mode on completion', async () => {
  const tty = terminal(), pending = hiddenInput('Password: ', tty.input, tty.output);
  assert(tty.input.isRaw);
  tty.input.emit('data', Buffer.from('correct-horseX\u007fbattery\r'));
  const result = await pending; assert(result === 'correct-horsebattery'); assert(!tty.input.isRaw);
  assert.equal(tty.displayed(), 'Password: \n'); assert.equal(tty.input.listenerCount('data'), 0);
});
test('hidden input preserves multibyte character boundaries and rejects cancellation, EOF and overflow without echo', async () => {
  const tty = terminal(), pending = hiddenInput('Password: ', tty.input, tty.output), bytes = Buffer.from('界');
  tty.input.emit('data', bytes.subarray(0, 1)); tty.input.emit('data', bytes.subarray(1)); tty.input.emit('data', Buffer.from('\r'));
  assert.equal(await pending, '界');
  for (const value of ['\u0003', 'x'.repeat(257), undefined]) {
    const next = terminal(), attempt = hiddenInput('Password: ', next.input, next.output);
    if (value === undefined) next.input.emit('end'); else next.input.emit('data', Buffer.from(value));
    await assert.rejects(attempt); assert(!next.input.isRaw); assert.equal(next.displayed(), 'Password: \n');
  }
});
test('admin initialization rejects argv passwords and non-interactive input before touching the database', async () => {
  await assert.rejects(adminCli(['--username', 'operator', '--password', 'forbidden-value']), (error: Error) => !error.message.includes('forbidden-value'));
  const tty = terminal(); tty.input.isTTY = false; assert.throws(() => hiddenInput('Password: ', tty.input, tty.output));
});
