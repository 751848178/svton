import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const webRequire = createRequire(new URL('../package.json', import.meta.url));
const uiRequire = createRequire(new URL('../../../packages/ui/package.json', import.meta.url));
const { JSDOM } = uiRequire('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = webRequire('react');
const { act } = React;
const { createRoot } = webRequire('react-dom/client');
const difference = key => ({ added: [key], removed: [], changed: [], noEnvChanged: false });
const draft = { id: 'draft', projectId: 'project', targetKey: 'prod', name: '生产配置', etag: 'one', status: 'draft', defaults: [{ key: 'GLOBAL', value: 'global', secret: false, hasValue: true }], services: [{ serviceKey: 'api', noEnv: false, variables: [{ key: 'A', value: 'original', secret: false, hasValue: true }] }, { serviceKey: 'admin', noEnv: false, variables: [] }] };

function harness(initial = draft) {
  const modules = new Map(), requests = [], previewKeys = [];
  let current = initial, preview = { data: { etag: 'one', services: { api: difference('OLD') } }, isLoading: false };
  const load = relative => {
    if (modules.has(relative)) return modules.get(relative);
    const base = new URL(`../src/${relative}`, import.meta.url);
    const path = ['.tsx', '.ts'].map(extension => new URL(`${base}${extension}`)).find(file => existsSync(file));
    const { outputText } = transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
    const exports = {};
    const require = name => {
      if (name === '@svton/ui') return { Select: ({ options, ...props }) => React.createElement('select', props, options.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label))) };
      if (name === '@/hooks/use-api') return { useApi: (route, params) => { if (route) previewKeys.push({ ...params }); return route ? { ...preview, mutate: async () => {} } : {}; } };
      if (name === '@/lib/api') return { request: async (route, input) => {
        requests.push({ route, input });
        if (route.startsWith('PATCH')) for (const patch of input.services) {
          const previous = current.services.find(service => service.serviceKey === patch.serviceKey);
          if (patch.noEnv && previous.variables.some(variable => !patch.variables?.some(value => value.key === variable.key && value.delete))) throw new Error('无需环境变量的服务不能同时设置变量，请先明确删除');
        }
        return { ...current, etag: 'two', name: input.name ?? current.name, services: current.services.map(service => input.services?.find(patch => patch.serviceKey === service.serviceKey)?.noEnv ? { ...service, noEnv: true, variables: [] } : service) };
      } };
      if (name === './primitives') return { ErrorMessage: ({ error }) => error ? React.createElement('p', { role: 'alert' }, String(error)) : null };
      if (name === './config-store-error') return { ConfigStoreError: () => null };
      if (name.startsWith('@/')) return load(name.slice(2));
      if (name.startsWith('./')) return load(`${relative.slice(0, relative.lastIndexOf('/') + 1)}${name.slice(2)}`);
      return webRequire(name);
    };
    runInNewContext(outputText, { exports, require, TextDecoder });
    modules.set(relative, exports); return exports;
  };
  const { ConfigDraftEditor } = load('components/config-draft-editor');
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const render = () => root.render(React.createElement(ConfigDraftEditor, { key: current.etag, draft: current, nextVersion: '0.0.1', onSaved: value => { current = value; render(); }, onFrozen() {}, onClose() {} }));
  return { container, requests, previewKeys, async mount() { await act(async () => render()); }, async preview(value) { preview = value; await act(async () => render()); }, async close() { await act(async () => root.unmount()); container.remove(); } };
}
function button(container, text) { return [...container.querySelectorAll('button')].find(item => item.textContent === text); }
async function change(input, value) {
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function deferredImport(container, prefix) {
  let resolve, reject, reads = 0;
  const pending = new Promise((success, failure) => { resolve = success; reject = failure; });
  const file = new dom.window.File(['pending'], '.env', { type: 'text/plain' });
  file.arrayBuffer = () => { reads++; return pending; };
  const input = container.querySelector(`input[aria-label="${prefix} 导入环境变量文件"]`);
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
  return { input, get reads() { return reads; }, async resolve(text) { await act(async () => { resolve(new TextEncoder().encode(text).buffer); await pending; }); }, async reject() { await act(async () => { reject(new Error('file unavailable')); await pending.catch(() => {}); }); } };
}

test('pending service import locks the entire draft and merges UTF-8 variables before saving', async () => {
  const h = harness(); await h.mount();
  try {
    assert.equal(button(h.container, '冻结为版本').disabled, false);
    await change(h.container.querySelector('[aria-label="api A的值"]'), 'edited-before-import');
    assert.equal(button(h.container, '保存草稿').disabled, false);
    const file = await deferredImport(h.container, 'api');
    for (const control of h.container.querySelectorAll('input:not([type=file]), select, button')) assert.equal(control.disabled, true, `${control.getAttribute('aria-label') || control.textContent} must be locked`);
    assert.match(h.container.textContent, /正在读取环境变量文件/);
    await act(async () => { button(h.container, '冻结为版本').click(); button(h.container, '保存草稿').click(); file.input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(h.requests.length, 0); assert.equal(file.reads, 1);
    await file.resolve('B=中文值\nEMPTY=');
    assert.equal(h.container.querySelector('[aria-label="api A的值"]').value, 'edited-before-import');
    assert.equal(h.container.querySelector('[aria-label="api B的值"]').value, '中文值');
    assert.equal(h.container.querySelector('[aria-label="api B的值"]').type, 'password');
    assert.equal(h.container.querySelector('[aria-label="api EMPTY的值"]').value, '');
    assert.equal(button(h.container, '保存草稿').disabled, false);
    assert.equal(button(h.container, '冻结为版本').disabled, true);
    await act(async () => button(h.container, '保存草稿').click());
    const saved = h.requests.find(item => item.route.startsWith('PATCH'));
    assert.equal(saved.input.etag, 'one');
    const variables = saved.input.services.find(service => service.serviceKey === 'api').variables;
    assert.equal(variables.find(item => item.key === 'A').value, 'edited-before-import');
    assert.equal(variables.find(item => item.key === 'B').value, '中文值');
    assert.equal(variables.find(item => item.key === 'EMPTY').value, '');
  } finally { await h.close(); }
});

test('a clean draft cannot freeze while a file is pending and unlocks after import failure', async () => {
  const h = harness(); await h.mount();
  try {
    const file = await deferredImport(h.container, '公共默认变量');
    assert.equal(button(h.container, '冻结为版本').disabled, true);
    await act(async () => button(h.container, '冻结为版本').click());
    assert.equal(h.requests.length, 0);
    await file.reject();
    assert.match(h.container.textContent, /file unavailable/);
    assert.equal(button(h.container, '冻结为版本').disabled, false);
    assert.equal(h.container.querySelector('[aria-label="公共默认变量 GLOBAL的值"]').disabled, false);
    assert.equal(button(h.container, '保存草稿').disabled, true);
  } finally { await h.close(); }
});

test('saving changes the preview revision and stale, failed, or pending previews cannot freeze', async () => {
  const h = harness(); await h.mount();
  try {
    assert.match(h.container.querySelector('.config-saved-preview').textContent, /OLD/);
    await change(h.container.querySelector('label input:not([aria-label])'), '保存后的名称');
    await act(async () => button(h.container, '保存草稿').click());
    assert.equal(h.previewKeys.at(-1).etag, 'two');
    assert.equal(h.previewKeys.at(-1).targetKey, 'prod');
    assert.doesNotMatch(h.container.querySelector('.config-saved-preview').textContent, /OLD/);
    assert.equal(button(h.container, '冻结为版本').disabled, true);
    await act(async () => button(h.container, '冻结为版本').click());
    assert.equal(h.requests.filter(item => item.route.endsWith('/freeze')).length, 0);
    const data = { etag: 'two', services: { api: difference('CURRENT') } };
    await h.preview({ data, error: new Error('read failed'), isLoading: false });
    assert.equal(button(h.container, '冻结为版本').disabled, true);
    await h.preview({ data, isLoading: true });
    assert.equal(button(h.container, '冻结为版本').disabled, true);
    await h.preview({ data, isLoading: false });
    assert.match(h.container.querySelector('.config-saved-preview').textContent, /CURRENT/);
    assert.equal(button(h.container, '冻结为版本').disabled, false);
    await act(async () => button(h.container, '冻结为版本').click());
    assert.equal(h.requests.at(-1).input.etag, 'two');
    assert.equal(h.requests.at(-1).input.version, '0.0.1');
  } finally { await h.close(); }
});

test('noEnv explicitly deletes saved service variables, preserves toggle undo inputs, and can freeze after saving', async () => {
  const variables = ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, value: `${key}-saved`, secret: false, hasValue: true }));
  const initial = { ...draft, services: [{ serviceKey: 'api', noEnv: false, variables }] };
  const h = harness(initial); await h.mount();
  try {
    await change(h.container.querySelector('[aria-label="api A的值"]'), 'A-edited');
    const noEnv = () => h.container.querySelector('details .inline-checkbox input');
    await act(async () => noEnv().click());
    assert.equal(h.container.querySelector('[aria-label="api A的值"]'), null);
    assert.match(h.container.textContent, /保存将删除此服务已有变量/);
    await act(async () => noEnv().click());
    assert.equal(h.container.querySelector('[aria-label="api A的值"]').value, 'A-edited');
    assert.equal(h.container.querySelector('[aria-label="api E的值"]').value, 'E-saved');
    await act(async () => noEnv().click());
    await act(async () => button(h.container, '保存草稿').click());
    const patch = h.requests.find(item => item.route.startsWith('PATCH')).input.services[0];
    assert.equal(patch.noEnv, true);
    assert.deepEqual(JSON.parse(JSON.stringify(patch.variables)), variables.map(({ key }) => ({ key, delete: true })));
    assert.equal(noEnv().checked, true);
    assert.doesNotMatch(h.container.textContent, /无需环境变量的服务不能同时设置变量/);
    await h.preview({ data: { etag: 'two', services: { api: { added: [], removed: variables.map(({ key }) => key), changed: [], noEnvChanged: true } } }, isLoading: false });
    assert.equal(button(h.container, '冻结为版本').disabled, false);
    await act(async () => button(h.container, '冻结为版本').click());
    assert.equal(h.requests.at(-1).route.endsWith('/freeze'), true);
    assert.equal(h.requests.at(-1).input.etag, 'two');
  } finally { await h.close(); }
});
