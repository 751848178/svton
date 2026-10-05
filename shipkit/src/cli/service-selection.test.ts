// --services parsing/resolution (MS-01): every invalid selection refuses
// BEFORE a builder exists; the runtime-dependent checks run against a
// GroupStateView without touching any machine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectSpec } from '../shared/spec-v2.js';
import type { GroupStateView } from '../shared/group-protocol.js';
import { parseServicesArg, resolveSelection, assertFirstDeployComplete, assertNoDroppedServices } from './service-selection.js';

const spec = validateProjectSpec({
  schemaVersion: 2,
  name: 'twgg',
  services: { backend: {}, admin: {}, mobile: {} },
});

test('parse: undefined = default-all; a comma list parses; whitespace tolerated', () => {
  assert.equal(parseServicesArg(undefined), undefined);
  assert.deepEqual(parseServicesArg('admin'), ['admin']);
  assert.deepEqual(parseServicesArg('backend, mobile'), ['backend', 'mobile']);
});

test('parse refusals: empty value, empty item, duplicates, invalid name — all before any machine exists', () => {
  assert.throws(() => parseServicesArg(''), /--services is empty/);
  assert.throws(() => parseServicesArg(' , '), /--services is empty/);
  assert.throws(() => parseServicesArg('admin,'), /empty name/);
  assert.throws(() => parseServicesArg('admin,admin'), /duplicate/);
  assert.throws(() => parseServicesArg('Admin'), /invalid/);
  assert.throws(() => parseServicesArg('web api'), /invalid/);
});

test('resolve: default selects every declared service; unknown names refuse with the known list', () => {
  assert.deepEqual(resolveSelection(spec, undefined), ['backend', 'admin', 'mobile']);
  assert.deepEqual(resolveSelection(spec, ['admin']), ['admin']);
  assert.throws(() => resolveSelection(spec, ['backend', 'nope']), /unknown service\(s\): nope.*backend, admin, mobile/);
});

test('prototype names are unknown unless explicitly declared services', () => {
  assert.throws(() => resolveSelection(spec, parseServicesArg('constructor')), /unknown service\(s\): constructor/);
  const explicit = validateProjectSpec({ schemaVersion: 2, name: 'twgg', services: { backend: {}, constructor: {} } });
  assert.deepEqual(resolveSelection(explicit, ['constructor']), ['constructor']);
});

const stateWith = (services: Record<string, unknown>): GroupStateView =>
  ({ schemaVersion: 2, app: 'twgg', current: services ? 'r1' : null, services: services as GroupStateView['services'] });

test('first deployment must cover every service — a partial selection is refused with the missing list', () => {
  assert.throws(() => assertFirstDeployComplete(['admin'], spec), /first deployment.*missing required services: backend, mobile/);
  assertFirstDeployComplete(['admin', 'backend', 'mobile'], spec);
});

test('services running on the runtime but absent from the new spec are never silently dropped', () => {
  const state = stateWith({ backend: {}, admin: {}, legacy: {} });
  assert.throws(() => assertNoDroppedServices(state, spec), /legacy.*absent from ship.yaml/);
  assertNoDroppedServices(stateWith({ backend: {}, admin: {} }), spec);
});

test('a committed constructor service cannot be silently dropped through a prototype lookup', () => {
  assert.throws(() => assertNoDroppedServices(stateWith({ constructor: {} }), spec), /constructor.*absent from ship.yaml/);
  const explicit = validateProjectSpec({ schemaVersion: 2, name: 'twgg', services: { constructor: {} } });
  assertNoDroppedServices(stateWith({ constructor: {} }), explicit);
});
