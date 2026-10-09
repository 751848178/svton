// Read-only audit of isolated fixture API evidence; never prints secret values.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { testSessionCookie } from '../../../shipkit/scripts/platform-test-session.mjs';

const fixturePath = process.argv[2] ?? '/tmp/codex-tool-runs/svton/platform-fixture.json';
const reportPath = process.argv[3] ?? '/tmp/codex-tool-runs/svton/platform-api-secret-audit.json';
const base = process.env.SHIPKIT_AUDIT_API ?? 'http://127.0.0.1:8770/api';
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const configuration = JSON.parse(await readFile(fixture.configPath, 'utf8'));
const secrets = new Set([fixture.token]);
function collect(value, key = '') {
  if (typeof value === 'string' && /token|password|secret|credential/i.test(key) && value.length >= 3) secrets.add(value);
  else if (value && typeof value === 'object') for (const [name, item] of Object.entries(value)) collect(item, name);
}
collect(configuration);
for (const service of Object.values(fixture.spec.services)) {
  if (!service.envFile) continue;
  const content = await readFile(path.join(fixture.project, service.envFile), 'utf8');
  for (const line of content.split('\n')) {
    const match = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=(.*)$/.exec(line.trim());
    const value = match?.[1]?.replace(/^(['"])(.*)\1$/, '$2');
    if (value && value.length >= 3) secrets.add(value);
  }
}
const candidates = [...secrets].filter((value) => typeof value === 'string');
let responseCount = 0;
let secretMatches = 0;
let logBytesRead = 0;
let eventPages = 0;
const unexpectedStatus = [];
function scan(text) { for (const secret of candidates) if (text.includes(secret)) secretMatches++; }
async function read(route) {
  const response = await fetch(`${base}${route}`, { headers: { cookie: await testSessionCookie(base) } });
  const text = await response.text();
  responseCount++; scan(text);
  if (!response.ok) unexpectedStatus.push({ route, status: response.status });
  return JSON.parse(text);
}
const projects = await read('/projects');
const projectId = fixture.projectId ?? projects.items.find((project) => project.rootPath === fixture.project)?.id;
if (!projectId) throw new Error('Isolated fixture is not registered');
await read(`/projects/${projectId}/status`);
await read(`/projects/${projectId}/history`);
const tasks = (await read(`/projects/${projectId}/tasks`)).items;
const suffix = Math.max(...candidates.map((value) => value.length), 1);
for (const task of tasks) {
  await read(`/tasks/${task.id}`);
  let after = 0;
  for (let page = 0; page < 256; page++) {
    const result = await read(`/tasks/${task.id}/events?after=${after}`); eventPages++;
    if (!result.events.length || result.nextSeq <= after) break;
    after = result.nextSeq;
  }
  for (const stage of ['provision', 'build', 'push', 'cleanup', 'deploy', 'verify']) {
    for (const service of [undefined, ...Object.keys(fixture.spec.services)]) {
      let offset = 0;
      let tail = '';
      for (let page = 0; page < 256; page++) {
        const params = new URLSearchParams({ stage, offset: String(offset), ...(service ? { service } : {}) });
        const result = await read(`/tasks/${task.id}/logs?${params}`);
        scan(tail + result.text); tail = (tail + result.text).slice(-suffix);
        logBytesRead += Buffer.byteLength(result.text);
        if (result.nextOffset >= result.totalBytes || result.nextOffset <= offset) break;
        offset = result.nextOffset;
      }
    }
  }
}
const report = { capturedAt: new Date().toISOString(), projectId, taskCount: tasks.length, responseCount, eventPages,
  logBytesRead, secretCandidateCount: candidates.length, secretMatches, unexpectedStatus,
  passed: secretMatches === 0 && unexpectedStatus.length === 0 };
await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ taskCount: report.taskCount, responseCount, logBytesRead, secretCandidateCount: candidates.length, secretMatches, passed: report.passed, reportPath }));
if (!report.passed) process.exitCode = 1;
