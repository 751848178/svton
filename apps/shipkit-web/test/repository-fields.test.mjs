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
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'FileList']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
const React = webRequire('react');
const { act } = React;
const { createRoot } = webRequire('react-dom/client');
const repository = { url: 'https://git.example.com/team/app.git', ref: { kind: 'branch', value: 'main' }, specPath: 'ship.yaml' };

function harness() {
  const modules = new Map(), requests = [];
  const query = { data: { repository: { ...repository, revision: 1 }, hasCredential: false }, async mutate(value) { query.data = value; } };
  const request = async (route, input) => {
    requests.push({ route, input });
    if (route.startsWith('PATCH')) return { repository: { ...input.repository, revision: 2 }, hasCredential: false };
    if (route === 'POST:/projects') return { id: 'registered', ...input };
    return { sourceSnapshot: { appName: 'fixture', commit: `verified-${requests.length}`, requestedRef: input.repository.ref, specPath: input.repository.specPath, spec: { services: {} } } };
  };
  const load = relative => {
    if (modules.has(relative)) return modules.get(relative);
    const base = new URL(`../src/${relative}`, import.meta.url);
    const path = ['.tsx', '.ts'].map(extension => new URL(`${base}${extension}`)).find(file => existsSync(file));
    const { outputText } = transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
    const exports = {};
    const require = name => {
      if (name === '@/lib/api') return { request, errorText: String };
      if (name === '@/hooks/use-api' || name === './use-api') return { useApi: () => query };
      if (name.startsWith('@/')) return load(name.slice(2));
      if (name.startsWith('./')) return load(`${relative.slice(0, relative.lastIndexOf('/') + 1)}${name.slice(2)}`);
      return webRequire(name);
    };
    runInNewContext(outputText, { exports, require, URL }); modules.set(relative, exports); return exports;
  };
  return { load, requests };
}
async function mount(element) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); await act(async () => root.render(element));
  return { container, close: async () => { await act(async () => root.unmount()); container.remove(); } };
}
function button(text) { return [...document.querySelectorAll('button')].find(item => item.textContent === text); }
async function change(input, value) {
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function choose(id, label) {
  const trigger = document.getElementById(id); assert.equal(trigger.getAttribute('role'), 'combobox');
  await act(async () => trigger.click());
  const option = [...document.querySelectorAll('[role=option]')].find(item => item.textContent === label);
  assert(option, `Missing provider option: ${label}`); await act(async () => option.click());
}

test('shared repository fields render all provider choices and normalize automatic selection without a provider', async () => {
  const h = harness(); const { RepositoryFields } = h.load('components/repository-fields');
  const { repositoryInput } = h.load('lib/repository-input');
  let selected;
  function Editor() {
    const [value, setValue] = React.useState(repository);
    return React.createElement(RepositoryFields, { value, onChange: next => { selected = next; setValue(next); }, token: '', onToken() {}, username: '', onUsername() {} });
  }
  const rendered = await mount(React.createElement(Editor));
  try {
    assert.equal(document.getElementById('repository-provider').textContent, '自动识别');
    assert.match(rendered.container.textContent, /部署令牌仅支持 Git 读取时/);
    assert.match(rendered.container.textContent, /主机仍需管理员开放/);
    for (const [value, label] of [['github', 'GitHub（github.com）'], ['gitlab', 'GitLab（含自建）'], ['gitea', 'Gitea'], ['generic', '通用HTTPS Git']]) {
      await choose('repository-provider', label); assert.equal(repositoryInput(selected).provider, value);
    }
    await choose('repository-provider', '自动识别');
    assert.equal(Object.hasOwn(repositoryInput(selected), 'provider'), false);
    assert.equal(Object.hasOwn(repositoryInput({ ...repository, provider: '' }), 'provider'), false);
    assert.throws(() => repositoryInput({ ...repository, provider: 'unsupported' }), /仓库服务/);
  } finally { await rendered.close(); }
});

test('settings provider changes invalidate the prior preview and save only newly verified provider inputs', async () => {
  const h = harness(); const { RepositorySettings } = h.load('components/repository-settings');
  const rendered = await mount(React.createElement(RepositorySettings, { project: { id: 'project', sourceKind: 'repository', repository: { ...repository, revision: 1 } }, onRefresh() {} }));
  try {
    await act(async () => button('读取并核对仓库').click());
    assert(rendered.container.querySelector('.repository-preview'));
    assert.equal(Object.hasOwn(h.requests[0].input.repository, 'provider'), false);
    await choose('repository-provider', 'GitLab（含自建）');
    assert.equal(rendered.container.querySelector('.repository-preview'), null);
    assert.equal(button('保存仓库设置').disabled, true);
    await act(async () => button('保存仓库设置').click()); assert.equal(h.requests.length, 1);
    await act(async () => button('读取并核对仓库').click());
    assert.equal(h.requests.at(-1).input.repository.provider, 'gitlab');
    await act(async () => button('保存仓库设置').click());
    assert.equal(h.requests.at(-1).input.repository.provider, 'gitlab');
    assert.equal(h.requests.at(-1).input.revision, 1);
    assert.equal(h.requests.at(-1).input.expectedCommit, 'verified-2');
    await choose('repository-provider', '自动识别');
    await act(async () => button('读取并核对仓库').click());
    await act(async () => button('保存仓库设置').click());
    assert.equal(Object.hasOwn(h.requests.at(-1).input.repository, 'provider'), false);
  } finally { await rendered.close(); }
});

test('project intake shares provider selection, invalidates old verification, and submits the new verified service', async () => {
  const h = harness(); const { ProjectRegistrationModal } = h.load('components/project-registration');
  const rendered = await mount(React.createElement(ProjectRegistrationModal, { open: true, onClose() {}, onSaved() {} }));
  try {
    await change(document.querySelector('[name=name]'), 'Git fixture');
    await change(document.querySelector('[name=configPath]'), '/tmp/shipkit-fixture-connections.yaml');
    await change(document.getElementById('intake-url'), repository.url);
    await choose('intake-provider', '通用HTTPS Git');
    await act(async () => button('读取并核对仓库').click());
    assert.equal(h.requests.at(-1).input.repository.provider, 'generic');
    await choose('intake-provider', 'Gitea');
    assert.equal(document.querySelector('.repository-preview'), null);
    assert.equal(button('登记项目').disabled, true);
    await act(async () => button('登记项目').click()); assert.equal(h.requests.length, 1);
    await act(async () => button('读取并核对仓库').click());
    assert.equal(h.requests.at(-1).input.repository.provider, 'gitea');
    await act(async () => button('登记项目').click());
    assert.equal(h.requests.at(-1).route, 'POST:/projects');
    assert.equal(h.requests.at(-1).input.repository.provider, 'gitea');
    assert.equal(h.requests.at(-1).input.expectedCommit, 'verified-2');
  } finally { await rendered.close(); }
});
