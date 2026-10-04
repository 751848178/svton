// Optional-field clear regression (M1-11, audit case A12): on a REAL pty
// (expect-allocated) the TtyPrompter must distinguish "keep default" (Enter)
// from "clear it" (`-`), while non-interactive mode keeps defaults verbatim
// (no accidental clear).

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrompter } from './prompt.js';
import { ptyAvailable, runExpectScript } from './pty-driver.js';

test('non-interactive: a clearable default is kept verbatim — clearing needs a TTY or a file edit', async () => {
  const p = createPrompter(false);
  const answer = await p.ask({ field: 'healthcheckPath', label: '健康检查路径', default: '/health', optional: true, clearable: true });
  assert.equal(answer, '/health');
});

test('A12: real pty — Enter keeps the default, `-` clears it', { skip: !ptyAvailable() }, async () => {
  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'prompt.js');
  const result = await runExpectScript(`
set timeout 20
spawn node --input-type=module -e {
  const { pathToFileURL } = await import('node:url');
  const { createPrompter } = await import(pathToFileURL(process.env.SHIP_TEST_PROMPT).href);
  const p = createPrompter(true);
  const keep = await p.ask({ field: 'a', label: 'KEEPME', default: '/health', optional: true, clearable: true });
  const cleared = await p.ask({ field: 'b', label: 'CLEARME', default: '/health', optional: true, clearable: true });
  process.stdout.write('\\nRESULT:' + JSON.stringify({ keep: String(keep), cleared: String(cleared) }) + '\\n');
  process.exit(0);
}
expect {
  -re "KEEPME" { send "\\r"; exp_continue }
  -re "CLEARME" { send -- "-\\r"; exp_continue }
  -re "RESULT:(\\[^\\r\\n\\]*)" { puts "CAPTURED:$expect_out(1,string)"; exit 0 }
  timeout { puts "CAPTURED:TIMEOUT"; exit 1 }
}
`, { env: { SHIP_TEST_PROMPT: promptPath }, timeoutMs: 30_000 });

  const line = result.split('\n').map((l) => l.replace(/\r$/, '')).find((l) => l.startsWith('CAPTURED:'));
  assert.ok(line, `no capture line in output: ${result.slice(-400)}`);
  const body = line!.slice('CAPTURED:'.length);
  assert.notEqual(body, 'TIMEOUT');
  const parsed = JSON.parse(body) as { keep: string; cleared: string };
  assert.equal(parsed.keep, '/health', `Enter must keep the default: ${body}`);
  assert.equal(parsed.cleared, '', `a literal - must clear the value: ${body}`);
});
