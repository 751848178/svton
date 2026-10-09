import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const nativeRequire = createRequire(import.meta.url);
function load(path, require = nativeRequire) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const exports = {}; runInNewContext(outputText, { exports, require }); return exports;
}

test('failed config reads report unknown data and never describe an empty successfully loaded collection', () => {
  const { EnvironmentConfigs } = load('components/environment-configs.tsx', name => {
    if (name === '@/hooks/use-runtime-configs') return { useRuntimeConfigs: () => ({ drafts: { error: new Error('unavailable') }, versions: { error: new Error('unavailable') }, refresh() {} }) };
    if (name === '@/lib/config-form') return { nextConfigVersion: () => '0.0.1' };
    if (name === '@/lib/presentation') return { time: value => value };
    if (name === '@svton/ui') return { Select: () => createElement('div') };
    if (name === './primitives') return { EmptyPanel: () => null, LoadingPanel: () => null };
    if (name.startsWith('./')) return new Proxy({}, { get: () => () => null });
    return nativeRequire(name);
  });
  const html = renderToStaticMarkup(createElement(EnvironmentConfigs, { project: { id: 'project', targetKey: 'prod', targets: [], services: [] }, live: { targetKey: 'prod', targets: [{ targetKey: 'prod' }] } }));
  assert.match(html, /未读取版本/); assert.match(html, /配置版本未能读取/); assert.match(html, /重试读取配置/);
  assert.doesNotMatch(html, /0 个版本|还没有冻结配置版本/);
});

test('frozen config details disclose secret presence while preserving plain empty-string semantics', () => {
  const { ConfigVersionDetail } = load('components/config-version-detail.tsx', name => name === '@/lib/presentation' ? { time: value => value } : nativeRequire(name));
  const html = renderToStaticMarkup(createElement(ConfigVersionDetail, { value: { name: '生产', version: '1.0.0', targetKey: 'prod', createdAt: 'now', services: [{ serviceKey: 'api', noEnv: false, variables: [{ key: 'TOKEN', secret: true, hasValue: true, value: 'server-must-not-expose' }, { key: 'EMPTY', secret: false, hasValue: true, value: '' }] }] }, onClose() {} }));
  assert.match(html, /已设置（不展示秘密）/); assert.match(html, /空字符串/);
  assert.doesNotMatch(html, /server-must-not-expose/);
});
