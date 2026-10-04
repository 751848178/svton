import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpecObject, buildConfigObject, mergeSpec, mergeConfig,
  renderYaml, parseYaml, serialize, validateSpecText, validateConfigText, type InitAnswers,
} from './plan.js';
import { maskObject } from './mask.js';
import { validateSpec } from '../../shared/spec-schema.js';
import { validateConfig } from '../../shared/config.js';

function answers(over: Partial<InitAnswers> = {}): InitAnswers {
  return {
    name: 'demo-web', dockerfile: 'Dockerfile', ports: ['3000:3000'],
    healthcheckPath: '/health', healthcheckHostPort: 3000, envFile: 'deploy.env',
    builderUrl: 'https://builder.example.com', builderToken: 'builder-secret',
    targetName: 'staging', runtimeUrl: 'https://runtime.example.com', runtimeToken: 'runtime-secret',
    registryUrl: 'registry.example.com', registryNamespace: 'myteam',
    ...over,
  };
}

test('generated ship.yaml text passes the shared spec validator and keeps ports as strings', () => {
  const text = renderYaml(buildSpecObject(answers()));
  assert.ok(text.includes(`- '3000:3000'`), `port must be quoted: ${text}`);
  validateSpecText(text);
  const back = validateSpec(parseYaml(text));
  assert.equal(back.name, 'demo-web');
  assert.deepEqual(back.ports, ['3000:3000']);
});

test('generated ship.config.yaml text passes the shared config validator', () => {
  const text = renderYaml(buildConfigObject(answers()));
  validateConfigText(text);
  const cfg = validateConfig(parseYaml(text));
  assert.equal(cfg.builder.static?.url, 'https://builder.example.com');
  assert.equal(cfg.registry?.namespace, 'myteam');
  assert.equal(cfg.runtime.targets.staging?.url, 'https://runtime.example.com');
});

test('mergeSpec preserves user fields the wizard does not own', () => {
  const existing = { name: 'old', buildArgsPolicy: 'strict', buildArgs: { NEXT_PUBLIC_X: '1' }, context: './web', healthcheck: { path: '/old', timeoutSeconds: 30 } };
  const merged = mergeSpec(existing, buildSpecObject(answers()));
  assert.equal((merged as Record<string, unknown>).buildArgsPolicy, 'strict');
  assert.equal((merged as Record<string, unknown>).context, './web');
  assert.deepEqual((merged as Record<string, { NEXT_PUBLIC_X: string }>).buildArgs!, { NEXT_PUBLIC_X: '1' });
  assert.equal((merged as Record<string, { path: string }>).healthcheck!.path, '/health');
});

test('mergeSpec clears wizard-owned keys the user cleared', () => {
  const merged = mergeSpec({ name: 'x', ports: ['1:1'], envFile: 'a.env', healthcheck: { path: '/old' } }, buildSpecObject(answers({ ports: [], envFile: null, healthcheckPath: null, healthcheckHostPort: null })));
  assert.deepEqual(merged.ports, [], 'an explicit empty list is persisted as "no mapping" so EXPOSE cannot resurrect it (R4)');
  assert.ok(!('envFile' in merged));
  assert.ok(!('healthcheck' in merged));
});

test('mergeConfig preserves other runtime targets and unknown top-level sections', () => {
  const existing = {
    builder: { mode: 'dynamic', dynamic: { provider: 'tencent' } },
    source: { repo: 'git@x:y.git' },
    runtime: { targets: { prod: { url: 'https://p', token: 'pt' }, staging: { url: 'https://old', token: 'ot' } } },
  };
  const merged = mergeConfig(existing, buildConfigObject(answers()));
  assert.equal((merged.runtime as { targets: Record<string, { url: string }> }).targets.prod!.url, 'https://p');
  assert.equal((merged.runtime as { targets: Record<string, { url: string }> }).targets.staging!.url, 'https://runtime.example.com');
  assert.ok('source' in merged, 'user source section survives');
  assert.equal((merged.builder as { mode: string }).mode, 'static', 'wizard owns the builder block');
});

test('maskObject masks secret-bearing keys at any depth, arrays included', () => {
  const masked = maskObject({
    builder: { static: { url: 'https://builder.example.com', token: 'super-secret-value' } },
    targets: [{ name: 'a', password: 'abc123' }],
    registry: { namespace: 'myteam' },
    multi: 'first\nsecond',
  });
  const obj = masked as unknown as Record<string, unknown>;
  assert.equal(JSON.stringify(obj).includes('super-secret-value'), false);
  assert.equal(JSON.stringify(obj).includes('abc123'), false);
  assert.ok(JSON.stringify(obj).includes('********'));
  assert.ok(JSON.stringify(obj).includes('myteam'), 'non-secret values survive');
});

test('serialize writes JSON for .json configs and YAML otherwise', () => {
  const obj = buildConfigObject(answers());
  const json = serialize(obj, 'json');
  assert.doesNotThrow(() => JSON.parse(json));
  assert.equal(serialize(obj, 'yaml'), renderYaml(obj));
});
