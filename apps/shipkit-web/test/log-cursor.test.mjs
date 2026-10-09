import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

function harness(request) {
  const state = []; let cursor = 0; let dependencies; let pendingEffect; let cleanup;
  const timers = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useEffect(effect, next) { if (!dependencies || next.some((value, index) => value !== dependencies[index])) pendingEffect = { effect, dependencies: next }; },
  };
  const source = readFileSync(new URL('../src/hooks/use-stage-log.ts', import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021 } });
  const exports = {};
  runInNewContext(outputText, { exports, AbortController, require: name => name === 'react' ? react : { request }, setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {} });
  const flush = () => { if (!pendingEffect) return; cleanup?.(); const next = pendingEffect; pendingEffect = null; dependencies = next.dependencies; cleanup = next.effect(); };
  return { read(input = {}, effects = true) { cursor = 0; const result = exports.useStageLog(input.task || 'task', input.stage || 'build', input.service || '', false); if (effects) flush(); return result; }, flush, timers, stop() { cleanup?.(); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('completed archive is downloadable only after every log page has arrived', async () => {
  const offsets = [];
  const hook = harness(async (_route, query) => {
    offsets.push(query.offset);
    return query.offset === 0 ? { text: 'one\n', totalBytes: 8, nextOffset: 4, complete: true } : { text: 'two\n', totalBytes: 8, nextOffset: 8, complete: true };
  });
  hook.read(); await settle();
  assert.equal(hook.read().text, 'one\n');
  assert.equal(hook.read().complete, false);
  assert.equal(hook.timers[0].delay, 30);
  await hook.timers[0].fn();
  assert.equal(hook.read().text, 'one\ntwo\n');
  assert.equal(hook.read().complete, true);
  assert.deepEqual(offsets, [0, 4]);
  assert.equal(hook.timers.length, 1);
  hook.stop();
});
test('closing a drawer aborts outstanding reads and ignores late log pages', async () => {
  let resolvePage; let signal;
  const hook = harness((_route, _query, options) => { signal = options.signal; return new Promise(resolve => { resolvePage = resolve; }); });
  hook.read(); hook.stop();
  resolvePage({ text: 'late', totalBytes: 4, nextOffset: 4, complete: true }); await settle();
  assert.equal(signal.aborted, true);
  assert.equal(hook.read().text, '');
  assert.equal(hook.read().complete, false);
  assert.equal(hook.timers.length, 0);
});
test('switching stage or service never renders the previous scope, even before effects or late responses', async () => {
  const pending = [];
  const hook = harness((_route, query, options) => new Promise(resolve => pending.push({ query, signal: options.signal, resolve })));
  hook.read();
  pending[0].resolve({ text: 'old build log', totalBytes: 13, nextOffset: 13, complete: true }); await settle();
  assert.equal(hook.read().text, 'old build log');
  const switched = hook.read({ stage: 'push' }, false);
  assert.equal(switched.text, '');
  assert.equal(switched.bytes, 0);
  assert.equal(switched.complete, false);
  assert.equal(switched.loading, true);
  hook.flush();
  assert.equal(pending[0].signal.aborted, true);
  const filtered = hook.read({ stage: 'push', service: 'admin' }, false);
  assert.equal(filtered.text, '');
  hook.flush();
  pending[1].resolve({ text: 'stale push all', totalBytes: 14, nextOffset: 14, complete: true });
  pending[2].resolve({ text: 'admin push', totalBytes: 10, nextOffset: 10, complete: true }); await settle();
  assert.equal(hook.read({ stage: 'push', service: 'admin' }).text, 'admin push');
  assert.equal(pending[1].signal.aborted, true);
  hook.stop();
});
