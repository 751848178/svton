import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePortMapping } from './port-mapping.js';
import { validateSpec, SpecError } from './spec-schema.js';
import { validateServiceSpec } from './spec-v2.js';
import { renderComposeFile, explicitHostPort, firstContainerPort } from '../agent/compose.js';
import { renderServiceCompose, serviceExplicitHostPort, serviceFirstContainerPort } from '../agent/compose-service.js';

test('loopback binding preserves both port values and rendering in v1/v2', () => {
  const ports = ['127.0.0.1:28769:8769'];
  assert.deepEqual(parsePortMapping(ports[0]!), { hostIp: '127.0.0.1', hostPort: 28769, containerPort: 8769 });
  const v1 = validateSpec({ name: 'shipkit', ports });
  const v2 = validateServiceSpec('server', { ports });
  assert.equal(explicitHostPort(v1), 28769);
  assert.equal(serviceExplicitHostPort(v2), 28769);
  assert.equal(firstContainerPort(v1), 8769);
  assert.equal(serviceFirstContainerPort(v2), 8769);
  assert.match(renderComposeFile('shipkit', 'server:1', v1, false), /"127\.0\.0\.1:28769:8769"/);
  assert.match(renderServiceCompose('shipkit', 'server', 'server:1', v2, false), /"127\.0\.0\.1:28769:8769"/);
});

test('existing fixed/dynamic mappings and explicit health overrides remain compatible', () => {
  assert.deepEqual(parsePortMapping('8080:80'), { hostPort: 8080, containerPort: 80 });
  assert.deepEqual(parsePortMapping('80'), { containerPort: 80 });
  assert.equal(explicitHostPort(validateSpec({ name: 'a', ports: ['80'] })), undefined);
  assert.equal(serviceFirstContainerPort({ ports: ['80'] }), 80);
  assert.equal(serviceExplicitHostPort({ ports: ['127.0.0.1:8080:80'], healthcheck: { hostPort: 9000 } }), 9000);
});

test('invalid addresses, ranges, protocols and partial loopback forms are rejected', () => {
  for (const value of ['127.0.0.1:80', '0.0.0.0:8080:80', '10.0.0.1:8080:80', '[::1]:8080:80',
    '127.0.0.1:0:80', '127.0.0.1:8080:65536', '70000:80', '0', '80/udp', '80:80:80', ' 80']) {
    assert.equal(parsePortMapping(value), undefined, value);
    assert.throws(() => validateSpec({ name: 'a', ports: [value] }), SpecError, value);
    assert.throws(() => validateServiceSpec('server', { ports: [value] }), SpecError, value);
  }
});
