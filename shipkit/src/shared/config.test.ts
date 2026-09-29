import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, validateConfig } from './config.js';

const base = {
  builder: { mode: 'static', static: { url: 'http://1.2.3.4:7410', token: 't' } },
  runtime: { targets: { a: { url: 'http://1.2.3.5:7410', token: 't' } } },
};

const dynamicTencent = {
  mode: 'dynamic',
  dynamic: {
    provider: 'tencent',
    tencent: {
      region: 'ap-guangzhou',
      zone: 'ap-guangzhou-3',
      instanceType: 'S5.MEDIUM4',
      imageId: 'img-x',
      vpcId: 'vpc-x',
      subnetId: 'subnet-x',
      securityGroupIds: ['sg-x'],
      advertiseHost: '1.2.3.4',
    },
  },
};

test('accepts static builder + one runtime target', () => {
  const c = validateConfig(base);
  assert.equal(c.builder.mode, 'static');
  assert.equal(c.builder.static?.url, 'http://1.2.3.4:7410');
});

test('requires at least one runtime target', () => {
  assert.throws(() => validateConfig({ ...base, runtime: { targets: {} } }), ConfigError);
});

test('rejects unknown provider and incomplete tencent config', () => {
  assert.throws(() => validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'aws' } } }), ConfigError);
  assert.throws(
    () => validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { region: 'ap-guangzhou' } } } }),
    ConfigError,
  );
});

test('dynamic tencent config gets default keepMinutes', () => {
  const c = validateConfig({ ...base, builder: dynamicTencent });
  assert.equal(c.builder.dynamic?.keepMinutes, 30);
});

test('F31: registry must be a bare host[:port] — scheme/path rejected', () => {
  assert.equal(validateConfig(base).registry, undefined);
  assert.throws(() => validateConfig({ ...base, registry: { url: 'x' } }), ConfigError);
  assert.throws(() => validateConfig({ ...base, registry: { url: 'https://reg.example.com', namespace: 'team' } }), ConfigError);
  assert.throws(() => validateConfig({ ...base, registry: { url: 'reg.example.com/path', namespace: 'team' } }), ConfigError);
  const c = validateConfig({ ...base, registry: { url: 'reg.example.com:5000', namespace: 'team' } });
  assert.equal(c.registry?.url, 'reg.example.com:5000');
});

test('F18: installUrl requires installToken', () => {
  const tencent = dynamicTencent.dynamic.tencent;
  assert.throws(
    () => validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...tencent, installUrl: 'http://10.0.0.5:7411/install.sh' } } } }),
    ConfigError,
  );
  const ok = validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...tencent, installUrl: 'http://10.0.0.5:7411/install.sh', installToken: 'tok' } } } });
  assert.equal(ok.builder.dynamic?.tencent?.installToken, 'tok');
});

test('F20: maxLifetimeMinutes bounds enforced', () => {
  const t = dynamicTencent.dynamic.tencent;
  assert.throws(() => validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, maxLifetimeMinutes: 10 } } } }), ConfigError);
  const ok = validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, maxLifetimeMinutes: 180 } } } });
  assert.equal(ok.builder.dynamic?.tencent?.maxLifetimeMinutes, 180);
});

test('C/RA06: agentHost is a bare host — ports belong to agentPort', () => {
  const t = dynamicTencent.dynamic.tencent;
  for (const bad of ['https://x.example.com', 'x.example.com:8443', 'x.example.com 8443']) {
    assert.throws(
      () => validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, agentHost: bad } } } }),
      ConfigError,
      `agentHost='${bad}' must be rejected`,
    );
  }
  const ok = validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, agentHost: 'builder.internal.example.com' } } } });
  assert.equal(ok.builder.dynamic?.tencent?.agentHost, 'builder.internal.example.com');
});

test('C/RA06 corrected: https without agentHost is allowed (IP certificates exist since LE 2025-07)', () => {
  const t = dynamicTencent.dynamic.tencent;
  const ok = validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, agentScheme: 'https' } } } });
  assert.equal(ok.builder.dynamic?.tencent?.agentScheme, 'https');
});
