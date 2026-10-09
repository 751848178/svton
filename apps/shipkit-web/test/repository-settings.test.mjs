import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

function load(path, require = () => { throw new Error('Unexpected dependency'); }) {
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021 } });
  const exports = {}; runInNewContext(outputText, { exports, require, URL }); return exports;
}
const model = load('lib/repository-input');
const repository = revision => ({ url: 'https://git.example.com/team/app.git', ref: { kind: 'branch', value: 'main' }, specPath: 'ship.yaml', revision });
function harness() {
  const values = [], dependencies = [], requests = [];
  let cursor = 0, pending = [], patchError;
  const query = { data: { repository: repository(1), hasCredential: true, hasUsername: true }, async mutate(value) { query.data = value; } };
  const react = {
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!dependencies[index] || deps.some((value, position) => !Object.is(value, dependencies[index][position]))) pending.push(effect); dependencies[index] = deps; },
  };
  const request = async (route, input) => {
    requests.push({ route, input });
    if (route.startsWith('PATCH')) { if (patchError) throw patchError; return { repository: { ...input.repository, revision: 3 }, hasCredential: input.token !== null }; }
    return { sourceSnapshot: { commit: 'fixed-preview-commit' } };
  };
  const { useRepositorySettings } = load('hooks/use-repository-settings', name => name === 'react' ? react : name === '@/lib/repository-input' ? model : name === '@/lib/api' ? { request } : { useApi: () => query });
  return { query, requests, rejectPatch(error) { patchError = error; }, render() { let control; for (let pass = 0; pass < 5; pass++) { cursor = 0; pending = []; control = useRepositorySettings({ id: 'project', sourceKind: 'repository', repository: repository(1) }, () => {}); if (!pending.length) return control; for (const effect of pending) effect(); } return control; } };
}

test('repository preview reuses stored credentials and saves the verified commit with the original revision', async () => {
  const h = harness();
  h.render().edit({ ...repository(1), ref: { kind: 'branch', value: 'release' } });
  h.query.data = { repository: repository(2), hasCredential: true };
  const changed = h.render();
  assert.equal(changed.value.ref.value, 'release');
  assert.equal(changed.remoteChanged, true);
  assert.equal(changed.token, '');
  assert.equal(changed.username, '');
  await changed.read();
  assert.equal(Object.hasOwn(h.requests[0].input, 'token'), false);
  assert.equal(Object.hasOwn(h.requests[0].input, 'username'), false);
  const conflict = new Error('409 conflict'); h.rejectPatch(conflict);
  await h.render().save();
  assert.equal(h.requests[1].input.revision, 1);
  assert.equal(h.requests[1].input.expectedCommit, 'fixed-preview-commit');
  assert.equal(h.render().error, conflict);
  assert.equal(h.render().value.ref.value, 'release');
});

test('credential replacement is never backfilled and explicit clearing is distinct from omission', async () => {
  const h = harness();
  h.render().setToken('new-secret');
  await h.render().read();
  assert.equal(h.requests[0].input.token, 'new-secret');
  await h.render().save();
  assert.equal(h.render().token, '');
  assert.equal(h.render().preview, null);
  h.render().setClearCredential(true);
  await h.render().read();
  assert.equal(h.requests.at(-1).input.token, null);
});

test('Git access usernames are separate write-only credentials with independent explicit clearing', async () => {
  const h = harness(); h.render().setUsername(' deploy-reader ');
  await h.render().read();
  assert.equal(h.requests[0].input.username, 'deploy-reader');
  assert.doesNotMatch(h.requests[0].input.repository.url, /deploy-reader/);
  await h.render().save(); assert.equal(h.render().username, '');
  h.render().setClearUsername(true); await h.render().read();
  assert.equal(h.requests.at(-1).input.username, null);
  assert.equal(Object.hasOwn(h.requests.at(-1).input, 'token'), false);
  h.render().setClearCredential(true); await h.render().read();
  assert.equal(h.requests.at(-1).input.token, null);
  assert.equal(Object.hasOwn(h.requests.at(-1).input, 'username'), false);
});
