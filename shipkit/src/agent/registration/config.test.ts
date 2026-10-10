import test from 'node:test';
import assert from 'node:assert/strict';
import { readRegistrationConfig } from './config.js';
import { RegistrationIdentityError } from './identity-error.js';

test('registration is disabled by default and preserves legacy configuration independence', () => {
  assert.deepEqual(readRegistrationConfig({}), { mode: 'disabled' });
  assert.deepEqual(readRegistrationConfig({ SHIP_AGENT_REGISTRATION_MODE: 'disabled',
    SHIP_AGENT_TOKEN: 'legacy', SHIP_AGENT_SERVER_ORIGIN: 'http://old.invalid' }), { mode: 'disabled' });
});
test('persistent registration accepts canonical HTTPS, absolute CA and explicit legacy claim only', () => {
  const base = { SHIP_AGENT_REGISTRATION_MODE: 'persistent', SHIP_AGENT_SERVER_ORIGIN: 'https://ship.example:8443' };
  assert.deepEqual(readRegistrationConfig({ ...base, SHIP_AGENT_SERVER_CA_FILE: '/etc/shipkit/ca.pem',
    SHIP_AGENT_ENROLLMENT_FILE: '/etc/shipkit/enrollment.json', SHIP_AGENT_ENROLL_EXISTING_LEDGER: '1' }), {
    mode: 'persistent', serverOrigin: 'https://ship.example:8443', caFile: '/etc/shipkit/ca.pem',
    enrollmentFile: '/etc/shipkit/enrollment.json', allowLegacyEnrollment: true });
  assert.equal((readRegistrationConfig({ ...base, SHIP_AGENT_ENROLL_EXISTING_LEDGER: '0' }) as { allowLegacyEnrollment: boolean }).allowLegacyEnrollment, false);
  assert.ok(Object.isFrozen(readRegistrationConfig(base)));
});
test('unsupported modes, noncanonical origins and ambiguous registration paths fail without input echo', () => {
  const invalid = (env: NodeJS.ProcessEnv) => assert.throws(() => readRegistrationConfig(env), (error: unknown) => {
    assert.ok(error instanceof RegistrationIdentityError);
    assert.equal(error.code, 'REGISTRATION_CONFIG_INVALID');
    assert.doesNotMatch(error.message, /secret|password|ska_/);
    return true;
  });
  invalid({ SHIP_AGENT_REGISTRATION_MODE: 'automatic' });
  for (const origin of [undefined, '', 'http://localhost', 'https://ship.example/', 'https://ship.example/path',
    'https://ship.example?secret=1', 'https://secret:password@ship.example', 'https://SHIP.example', 'https://ship.example:443']) {
    invalid({ SHIP_AGENT_REGISTRATION_MODE: 'persistent', SHIP_AGENT_SERVER_ORIGIN: origin });
  }
  const base = { SHIP_AGENT_REGISTRATION_MODE: 'persistent', SHIP_AGENT_SERVER_ORIGIN: 'https://ship.example' };
  for (const value of ['', 'relative.pem', '/etc/shipkit/../secret', '/etc/shipkit/\nsecret']) {
    invalid({ ...base, SHIP_AGENT_SERVER_CA_FILE: value });
    invalid({ ...base, SHIP_AGENT_ENROLLMENT_FILE: value });
  }
  for (const value of ['', 'true', 'false', 'yes', '01', ' 1']) invalid({ ...base, SHIP_AGENT_ENROLL_EXISTING_LEDGER: value });
});
