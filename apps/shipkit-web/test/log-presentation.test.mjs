import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX, esModuleInterop: true } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => imports[name] || require(name) });
  return exports;
}
const model = load('lib/log-presentation.ts');
const { activityMessages, inLogScope, latestLogStages } = load('lib/stage-log-activity.ts');
const { FormattedLog } = load('components/formatted-log.tsx', { '@/lib/log-presentation': model });

test('BuildKit stages, cached/done output and package warnings have meaningful tones', () => {
  assert.equal(model.logKind('#5 [build 1/4] RUN pnpm install'), 'step');
  assert.equal(model.logKind('#5 CACHED'), 'success');
  assert.equal(model.logKind('#9 DONE 12.4s'), 'success');
  assert.equal(model.logKind('built shipbuild/api:tag (linux/amd64)'), 'success');
  assert.equal(model.logKind('npm WARN deprecated package'), 'warning');
  assert.equal(model.logKind('#12 4 high severity vulnerabilities'), 'warning');
  assert.equal(model.logKind('failed to solve: process did not complete'), 'error');
  assert.equal(model.logKind('npm ERR! code ELIFECYCLE'), 'error');
  assert.equal(model.logKind('ordinary compiler output'), 'text');
});
test('ANSI style persists across lines and resets without changing log text', () => {
  const lines = model.parseLog('\x1b[31;1mfirst\nsecond\x1b[0m plain\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[1].text, 'second plain');
  assert.equal(lines[0].segments[0].color, lines[1].segments[0].color);
  assert.equal(lines[0].segments[0].bold, true);
  assert.equal(lines[1].segments[1].color, undefined);
});
test('ANSI foregrounds meet readable contrast on the light log surface', () => {
  const luma = channels => channels.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
  for (const input of ['255,255,255', '255,255,0', '0,255,0', '0,255,255', '0,0,0', '255,0,0']) {
    const color = model.readableAnsiColor(input).match(/[\d.]+/g).map(Number);
    assert.ok((luma([255,255,255]) + .05) / (luma(color) + .05) >= 4.5, input);
  }
  assert.equal(model.readableAnsiColor('color:expression(alert(1))'), undefined);
});
test('React escapes HTML and ANSI payloads; no log text becomes executable markup', () => {
  const html = renderToStaticMarkup(createElement(FormattedLog, { text: '\x1b[31m<img src=x onerror="alert(1)">\x1b[0m', raw: false }));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  const raw = renderToStaticMarkup(createElement(FormattedLog, { text: '<script>alert(1)</script>', raw: true }));
  assert.ok(raw.includes('&lt;script&gt;'));
});
test('raw view makes ANSI and other controls visible while downloaded source remains untouched', () => {
  const text = '\x1b[31merror\x1b[0m\x08\nnext';
  const html = renderToStaticMarkup(createElement(FormattedLog, { text, raw: true }));
  assert.ok(html.includes('\\u001b[31merror\\u001b[0m\\u0008'));
  assert.ok(text.includes('\x1b'));
});
test('ANSI, CRLF and blank lines retain readable content and line order', () => {
  const lines = model.parseLog('one\r\n\r\n\x1b[32mtwo\x1b[0m\rthree');
  assert.deepEqual(JSON.parse(JSON.stringify(lines.map(line => line.text))), ['one', '', 'two', 'three']);
});
test('cursor and polling events are evidence, not repeated activity messages', () => {
  const events = [
    { seq: 1, type: 'log', message: 'log chunk' },
    { seq: 2, type: 'remote-job', message: 'polling' },
    { seq: 3, type: 'remote-event' },
    { seq: 4, type: 'stage', status: 'running' },
    { seq: 5, type: 'diagnostic', message: 'Registry unavailable', serviceKey: 'api' },
    { seq: 6, type: 'diagnostic', message: 'Registry unavailable', serviceKey: 'api' },
    { seq: 7, type: 'cleanup', message: 'Resource release failed' },
  ];
  const result = activityMessages(events);
  assert.equal(result.length, 2);
  assert.equal(result[0].message, 'Registry unavailable');
  assert.equal(result[0].occurrences, 2);
  assert.equal(result[1].message, 'Resource release failed');
});
test('latest attempt per service is shown once and parent placeholder is not duplicated', () => {
  const rows = latestLogStages([{ serviceKey: null, attempt: 1, status: 'pending' }, { serviceKey: 'api', attempt: 1, status: 'failed' }, { serviceKey: 'api', attempt: 2, status: 'succeeded' }, { serviceKey: 'web', attempt: 1, status: 'succeeded' }]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, 'succeeded');
  assert.equal(rows[0].attempt, 2);
});
test('service scope keeps shared stage evidence and excludes other services', () => {
  assert.equal(inLogScope({ stageKey: 'build', serviceKey: 'api' }, 'build', 'api'), true);
  assert.equal(inLogScope({ stageKey: 'build', serviceKey: null }, 'build', 'api'), true);
  assert.equal(inLogScope({ stageKey: 'build', serviceKey: 'web' }, 'build', 'api'), false);
  assert.equal(inLogScope({ stageKey: 'push', serviceKey: 'api' }, 'build', 'api'), false);
});
