import test from 'node:test';
import assert from 'node:assert/strict';
import { renderComposeFile, explicitHostPort, firstContainerPort, RUNTIME_ENV_FILE } from './compose.js';
import { validateSpec } from '../shared/spec-schema.js';

test('renders image/ports with isolated runtime.env, never .env (F15)', () => {
  const spec = validateSpec({ name: 'demo-web', ports: ['3000:3000'], envFile: 'deploy.env' });
  const y = renderComposeFile('demo-web', 'reg/team/demo-web@sha256:abc', spec, true);
  assert.match(y, /image: "reg\/team\/demo-web@sha256:abc"/);
  assert.match(y, /- "3000:3000"/);
  assert.match(y, new RegExp(`- "${RUNTIME_ENV_FILE}"`));
  assert.doesNotMatch(y, /- "\.env"/);
});

test('omits env_file when the release has no env', () => {
  const y = renderComposeFile('a', 'img:1', validateSpec({ name: 'a' }), false);
  assert.doesNotMatch(y, /env_file/);
});

test('explicitHostPort: healthcheck > HOST:CONTAINER > undefined for dynamic-only ports (F26)', () => {
  assert.equal(explicitHostPort(validateSpec({ name: 'a', healthcheck: { hostPort: 9090 }, ports: ['3000:3000'] })), 9090);
  assert.equal(explicitHostPort(validateSpec({ name: 'a', ports: ['8080:80'] })), 8080);
  assert.equal(explicitHostPort(validateSpec({ name: 'a', ports: ['3000'] })), undefined);
  assert.equal(explicitHostPort(validateSpec({ name: 'a' })), undefined);
});

test('firstContainerPort handles both port forms', () => {
  assert.equal(firstContainerPort(validateSpec({ name: 'a', ports: ['8080:80'] })), 80);
  assert.equal(firstContainerPort(validateSpec({ name: 'a', ports: ['3000'] })), 3000);
  assert.equal(firstContainerPort(validateSpec({ name: 'a' })), undefined);
});
