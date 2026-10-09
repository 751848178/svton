import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const require = createRequire(import.meta.url);
function panelHarness() {
  let cleanup; let menuOpen = false; let closed = 0;
  const handlers = new Map();
  const body = { style: { overflow: 'auto' }, inert: false };
  class Element { isConnected = true; focus() {} }
  let refIndex = 0;
  const react = {
    useState: () => [true, () => {}], useId: () => 'log-title',
    useRef: value => ({ current: refIndex++ === 0 ? { querySelector: () => menuOpen, contains: () => false } : value }),
    useEffect: effect => { cleanup = effect(); },
  };
  const document = { body, activeElement: new Element(), addEventListener: (name, callback) => handlers.set(name, callback), removeEventListener: name => handlers.delete(name) };
  const source = readFileSync(new URL('../src/components/log-side-panel.tsx', import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, document, HTMLElement: Element, require: name => name === 'react' ? react : name === 'react-dom' ? { createPortal: children => children } : require(name) });
  const markup = renderToStaticMarkup(createElement(exports.LogSidePanel, { title: '构建镜像 · 日志', onClose: () => closed++, children: '日志正文' }));
  return { markup, body, handlers, menu: value => { menuOpen = value; }, closed: () => closed, cleanup: () => cleanup() };
}
test('log panel is complementary without modal semantics, backdrop, focus trap or page scroll lock', () => {
  const panel = panelHarness();
  assert.ok(panel.markup.startsWith('<aside'));
  assert.ok(panel.markup.includes('aria-labelledby="log-title"'));
  assert.ok(!panel.markup.includes('aria-modal'));
  assert.ok(!panel.markup.includes('role="dialog"'));
  assert.ok(!panel.markup.includes('backdrop'));
  assert.equal(panel.body.style.overflow, 'auto');
  assert.equal(panel.body.inert, false);
  assert.deepEqual([...panel.handlers.keys()], ['keydown']);
  panel.cleanup();
});
test('Escape closes the panel, defers to an open Select and removes its listener on unmount', () => {
  const panel = panelHarness();
  const key = { key: 'Escape', defaultPrevented: false, isComposing: false };
  panel.menu(true); panel.handlers.get('keydown')(key);
  assert.equal(panel.closed(), 0);
  panel.menu(false); panel.handlers.get('keydown')({ ...key, defaultPrevented: true });
  assert.equal(panel.closed(), 0);
  panel.handlers.get('keydown')(key);
  assert.equal(panel.closed(), 1);
  panel.cleanup(); assert.equal(panel.handlers.size, 0);
});
