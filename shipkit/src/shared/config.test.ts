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

test('runtime target names must fit the deployment environment protocol before any cloud work', () => {
  for (const name of ['prod staging', '生产', '.prod', 'a'.repeat(65)]) {
    assert.throws(() => validateConfig({ ...base, runtime: { targets: { [name]: base.runtime.targets.a } } }), /runtime target name/);
  }
  assert.ok(validateConfig({ ...base, runtime: { targets: { 'prod.cn-1_a': base.runtime.targets.a } } }));
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

test('systemDisk preserves explicit Tencent disk type and GiB size; omission stays optional', () => {
  const t = dynamicTencent.dynamic.tencent;
  const build = (systemDisk?: unknown) => ({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, systemDisk } } } });
  assert.equal(validateConfig(build()).builder.dynamic?.tencent?.systemDisk, undefined);
  for (const diskType of ['LOCAL_BASIC', 'LOCAL_SSD', 'CLOUD_BASIC', 'CLOUD_SSD', 'CLOUD_PREMIUM', 'CLOUD_BSSD', 'CLOUD_HSSD', 'CLOUD_TSSD']) {
    const systemDisk = { diskType, diskSize: 100 };
    assert.deepEqual(validateConfig(build(systemDisk)).builder.dynamic?.tencent?.systemDisk, systemDisk);
  }
});

test('systemDisk rejects invalid shape, type and non-positive or unsafe integer size', () => {
  const t = dynamicTencent.dynamic.tencent;
  for (const systemDisk of [null, [], 'CLOUD_BSSD', {}, { diskType: 'SSD', diskSize: 100 }, { diskType: 'CLOUD_BSSD' },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100'].map(diskSize => ({ diskType: 'CLOUD_BSSD', diskSize }))]) {
    assert.throws(() => validateConfig({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, systemDisk } } } }), /systemDisk/);
  }
});

test('loginPassword enforces Linux 8–30 characters and rejects CR/LF without echoing the value', () => {
  const t = dynamicTencent.dynamic.tencent;
  const build = (loginPassword?: string) => ({ ...base, builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...t, loginPassword } } } });
  assert.equal(validateConfig(build()).builder.dynamic?.tencent?.loginPassword, undefined);
  for (const loginPassword of ['a'.repeat(8), 'b'.repeat(24), 'c'.repeat(30)]) {
    assert.equal(validateConfig(build(loginPassword)).builder.dynamic?.tencent?.loginPassword, loginPassword);
  }
  for (const loginPassword of ['a'.repeat(7), 'b'.repeat(31), 'c'.repeat(34), 'abc\ndefgh', 'abc\rdefgh']) {
    assert.throws(() => validateConfig(build(loginPassword)), error => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /loginPassword/);
      assert.equal(error.message.includes(loginPassword), false);
      return true;
    });
  }
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
