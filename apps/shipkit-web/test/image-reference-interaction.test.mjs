import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const webRequire = createRequire(new URL('../package.json', import.meta.url));
const uiRequire = createRequire(new URL('../../../packages/ui/package.json', import.meta.url));
const { JSDOM } = uiRequire('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
const React = webRequire('react');
const { act } = React;
const { createRoot } = webRequire('react-dom/client');
const modules = new Map();
function load(relative) {
  if (modules.has(relative)) return modules.get(relative);
  const base = new URL(`../src/${relative}`, import.meta.url);
  const file = ['.tsx', '.ts'].map(extension => new URL(`${base}${extension}`)).find(path => existsSync(path));
  const { outputText } = transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const exports = {};
  const require = name => {
    if (name === '@/lib/api') return { errorText: String, request() { throw new Error('Image interaction must not request a release'); } };
    if (name.startsWith('@/')) return load(name.slice(2));
    if (name.startsWith('./')) return load(`${relative.slice(0, relative.lastIndexOf('/') + 1)}${name.slice(2)}`);
    return webRequire(name);
  };
  runInNewContext(outputText, { exports, require, navigator: dom.window.navigator, window: dom.window, document: dom.window.document });
  modules.set(relative, exports);
  return exports;
}
const { ImageReference } = load('components/image-reference');
const { RollbackModal } = load('components/rollback-modal');
const { CommandCopy } = load('components/command-copy');
const image = `ccr.ccs.tencentyun.com/shipkit-zxb/backend@sha256:${'0123456789abcdef'.repeat(4)}`;
async function mount(element) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  return { container, close: async () => { await act(async () => root.unmount()); container.remove(); } };
}
function clipboard(writeText) { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } }); }

test('compact reference uses a real focus/hover tooltip and never expands inline content', async () => {
  const rendered = await mount(React.createElement(ImageReference, { value: image, prefix: '恢复至' }));
  try {
    assert.equal(rendered.container.querySelector('.image-reference-preview').textContent, 'sha256:0123456789ab…');
    assert.equal(rendered.container.querySelector('.image-reference-prefix').textContent, '恢复至 ·');
    assert.equal(rendered.container.querySelector('details'), null);
    const trigger = rendered.container.querySelector('[aria-label="查看完整镜像引用"]');
    await act(async () => trigger.focus());
    const tooltip = document.querySelector('[role="tooltip"]');
    assert.equal(tooltip.textContent, image);
    assert.equal(trigger.getAttribute('aria-describedby'), tooltip.id);
    assert.equal(rendered.container.querySelector('.image-reference').textContent.includes('ccr.ccs'), false);
    await act(async () => trigger.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="tooltip"]'), null);
    await act(async () => { trigger.blur(); trigger.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 120)); });
    assert.equal(document.querySelector('[role="tooltip"]').textContent, image);
  } finally { await rendered.close(); }
});

test('rollback copy preserves exact image bytes and selected checkbox with accessible success feedback', async () => {
  const copied = []; clipboard(async text => { copied.push(text); });
  const item = { releaseId: 'current-change', parentReleaseId: 'old-snapshot', changedServices: ['backend'], services: {}, restoreServices: { backend: { imageRef: image } }, rollbackAvailable: true };
  const rendered = await mount(React.createElement(RollbackModal, { item, history: { current: 'current-change', items: [item] }, project: { id: 'project' }, onClose() {}, onTask() { assert.fail('Copy must not start rollback'); } }));
  try {
    const checkbox = document.querySelector('#rollback-backend');
    assert.equal(checkbox.checked, true);
    const copy = document.querySelector('.rollback-option [aria-label="复制镜像引用"]');
    assert.equal(copy.textContent, '');
    await act(async () => copy.click());
    assert.deepEqual(copied, [image]);
    assert.equal(checkbox.checked, true);
    assert.equal(document.getElementById(copy.getAttribute('aria-describedby')).textContent, '已复制');
    assert.equal(copy.closest('.image-copy-control').querySelector('[role="status"]').getAttribute('aria-live'), 'polite');
  } finally { await rendered.close(); }
});

test('clipboard failures are explicit and default command-copy wording remains unchanged', async () => {
  clipboard(async () => { throw new Error('Clipboard permission denied'); });
  const rendered = await mount(React.createElement(ImageReference, { value: image }));
  try {
    const copy = rendered.container.querySelector('[aria-label="复制镜像引用"]');
    await act(async () => copy.click());
    const feedback = rendered.container.querySelector('.image-copy-feedback.error');
    assert.equal(feedback.textContent, '复制失败，请检查剪贴板权限后重试');
    assert.equal(feedback.id, copy.getAttribute('aria-describedby'));
  } finally { await rendered.close(); }
  const copied = []; clipboard(async text => copied.push(text));
  const command = await mount(React.createElement(CommandCopy, { command: 'ship release --services backend' }));
  try {
    const button = command.container.querySelector('[aria-label="复制命令"]');
    assert.equal(button.textContent, '复制命令');
    await act(async () => button.click());
    assert.equal(button.textContent, '已复制');
    assert.deepEqual(copied, ['ship release --services backend']);
  } finally { await command.close(); }
});
