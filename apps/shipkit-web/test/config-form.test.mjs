import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

function load(path) {
  const source = readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021 } });
  const exports = {}; runInNewContext(outputText, { exports, URL, TextDecoder }); return exports;
}
const { variableRows, variablePatches, serviceVariablePatches, importEnv, importEnvBytes, mergeImported, nextConfigVersion } = load('config-form');
const { repositoryInput } = load('repository-input');
const plain = value => JSON.parse(JSON.stringify(value));

test('secret editor never populates stored secret values, and preserves omitted values', () => {
  const rows = variableRows([{ key: 'TOKEN', secret: true, hasValue: true, value: 'must-not-return' }, { key: 'PORT', secret: false, hasValue: true, value: '3000' }]);
  assert.equal(rows[0].value, undefined);
  assert.equal(rows[0].savedValue, undefined);
  assert.deepEqual(plain(variablePatches(rows)), [{ key: 'TOKEN', secret: true }, { key: 'PORT', secret: false }]);
  assert.deepEqual(plain(variablePatches([{ ...rows[0], mode: 'set', value: '' }, { ...rows[1], mode: 'delete' }])), [{ key: 'TOKEN', value: '', secret: true }, { key: 'PORT', delete: true }]);
});

test('single line env imports preserve UTF-8, literal dollar signs, quotes and explicit empty values', () => {
  const text = '\uFEFF# comment\nTOKEN=\'引号 "$HOME # literal\'\nPLAIN=$KEEP#HASH # comment\nESCAPED="a\\"b"\nEMPTY=\n';
  const rows = importEnv(text);
  assert.deepEqual(plain(rows.map(row => [row.key, row.value, row.secret])), [['TOKEN', '引号 "$HOME # literal', true], ['PLAIN', '$KEEP#HASH', true], ['ESCAPED', 'a"b', true], ['EMPTY', '', true]]);
  const merged = mergeImported(variableRows([{ key: 'TOKEN', secret: true, hasValue: true }]), rows);
  assert.equal(merged[0].original, true);
  assert.equal(merged.length, 4);
  const plainOriginal = variableRows([{ key: 'PLAIN', secret: false, hasValue: true, value: 'original' }]);
  assert.equal(mergeImported(plainOriginal, rows)[0].savedValue, 'original');
});

test('noEnv service patches delete stored plain and secret variables while leaving unsaved inputs available for undo', () => {
  const rows = variableRows([{ key: 'TOKEN', secret: true, hasValue: true }, { key: 'EMPTY', secret: false, hasValue: true, value: '' }]);
  rows.push({ key: '', value: 'unfinished', secret: false, original: false, mode: 'set' });
  const before = plain(rows);
  assert.deepEqual(plain(serviceVariablePatches(rows, true)), [{ key: 'TOKEN', delete: true }, { key: 'EMPTY', delete: true }]);
  assert.deepEqual(plain(rows), before);
  assert.deepEqual(plain(serviceVariablePatches(rows.slice(0, 2), false)), [{ key: 'TOKEN', secret: true }, { key: 'EMPTY', secret: false }]);
});

test('ambiguous imports, duplicate names and multiline values cannot silently change a secret', () => {
  for (const text of ['A=one\nA=two', 'A="unterminated', 'A="a\\nb"', 'A="a"trailing', '1A=value']) assert.throws(() => importEnv(text));
  assert.throws(() => variablePatches([{ key: 'A', secret: true, mode: 'set', value: 'one\nline' }]));
  assert.deepEqual(plain(variablePatches([{ key: '', original: false, mode: 'delete' }])), []);
  assert.throws(() => importEnvBytes(new Uint8Array([0xff, 0xfe]).buffer), /UTF-8/);
  assert.equal(importEnvBytes(new TextEncoder().encode('A=中文').buffer)[0].value, '中文');
});

test('repository addresses reject credentials or unsafe schemes while a blank branch remains default-branch intent', () => {
  const value = { url: 'https://git.example.com/team/project.git', ref: { kind: 'branch', value: ' ' } };
  assert.deepEqual(plain(repositoryInput(value)), { ...value, ref: { kind: 'branch', value: '' }, specPath: 'ship.yaml' });
  for (const url of ['http://git.example.com/repo', 'https://secret@git.example.com/repo', 'https://git.example.com/repo?token=secret', 'https://git.example.com/repo#token', 'not-a-url']) assert.throws(() => repositoryInput({ ...value, url }));
  assert.throws(() => repositoryInput({ ...value, ref: { kind: 'tag', value: '' } }));
  assert.equal(nextConfigVersion([{ version: '0.0.9' }, { version: '1.0.0' }]), '1.0.1');
});
