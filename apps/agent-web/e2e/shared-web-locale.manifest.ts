import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceRecord } from './shared-web-locale.evidence';
import { sharedWebLocaleSourceFiles as sourceFiles } from './shared-web-locale.sources';
import {
  decisionManifest,
  readDecisionHashes,
  validateDecisionHashes,
  type DecisionHashes,
} from './shared-web-locale.decisions';

const evidenceBase = resolve(process.env.SVTON_C3_EVIDENCE_ROOT
  ?? '/tmp/codex-tool-runs/svton/uiimpl024-locale-evidence');
export const evidenceRunId = process.env.SVTON_C3_EVIDENCE_RUN_ID;
export const evidenceRoot = resolve(evidenceBase, evidenceRunId ?? 'missing-run-id');
const repositoryRoot = resolve(process.cwd(), '../..');
let capturedSourceHash = '';
let capturedDecisionHashes: DecisionHashes = {
  codeReview: '', timeline: '', skills: '', skillsResult: '',
};
let prepared = false;
const completedGroups = new Set<string>();
const expectedGroups = new Set([
  'en/shell', 'en/decisions', 'en/results', 'en/timeline',
  'zh/shell', 'zh/decisions', 'zh/results', 'zh/timeline',
]);
const scenarios = [
  'composer-empty', 'composer-disabled', 'session-search-menu', 'session-geometry-escape',
  'aux-automation', 'aux-skills', 'aux-agents', 'aux-integrations',
  'settings-compact', 'settings-pending', 'settings-wide-error', 'settings-back',
  'approval-pending', 'approval-settled', 'request-input-required', 'request-input-settled',
  'controller-file-failure', 'image-validation', 'result-blocks-transcript',
  'document-action', 'artifact-result', 'artifact-dirty', 'artifact-readonly',
  'timeline-command-complete', 'timeline-command-retry', 'timeline-tool-result',
  'timeline-provider-outcome', 'timeline-file-single', 'timeline-file-aggregate',
  'timeline-approval', 'timeline-locale-boundary',
];

export function prepareEvidenceRun(): void {
  if (!evidenceRunId) throw new Error('SVTON_C3_EVIDENCE_RUN_ID is required');
  mkdirSync(evidenceBase, { recursive: true });
  if (existsSync(evidenceRoot)) throw new Error(`immutable evidence run already exists: ${evidenceRoot}`);
  mkdirSync(evidenceRoot);
  capturedSourceHash = hashSources();
  capturedDecisionHashes = readDecisionHashes();
  completedGroups.clear();
  prepared = true;
}

export function markEvidenceGroupComplete(
  locale: 'en' | 'zh',
  group: 'shell' | 'decisions' | 'results' | 'timeline',
): void {
  completedGroups.add(`${locale}/${group}`);
}

export function finalizeEvidence(records: EvidenceRecord[]): void {
  if (!prepared) return;
  const currentSourceHash = hashSources();
  const currentDecisionHashes = readDecisionHashes();
  const problems = validate(records, currentSourceHash, currentDecisionHashes);
  const accepted = problems.length === 0;
  const finalRoot = accepted ? evidenceRoot : rejectRoot();
  if (!accepted) renameSync(evidenceRoot, finalRoot);
  const normalizedRecords = records.map((record) => normalizeRecord(record, finalRoot));
  const manifest = {
    schema: 'svton.uiimpl-024.browser-evidence.v1', accepted, immutable: true,
    evidenceBase, evidenceRoot: finalRoot, runId: evidenceRunId,
    serverCommand: process.env.SVTON_E2E_SERVER_COMMAND,
    execution: { workers: 1, retries: 0 },
    validationProblems: problems,
    source: {
      recipe: 'sha256(path + NUL + raw-bytes + NUL), files in listed order',
      files: sourceFiles, capturedSha256: capturedSourceHash,
      currentSha256: currentSourceHash, currentMatch: capturedSourceHash === currentSourceHash,
    },
    ...decisionManifest(capturedDecisionHashes, currentDecisionHashes, repositoryRoot),
    supersededRuns: supersededRuns(),
    records: normalizedRecords,
  };
  writeFileSync(resolve(finalRoot, accepted ? 'evidence.json' : 'rejected.json'), JSON.stringify(manifest, null, 2));
}

function validate(
  records: EvidenceRecord[],
  currentSourceHash: string,
  currentDecisionHashes: DecisionHashes,
): string[] {
  const problems: string[] = [];
  const expected = new Set(['en', 'zh'].flatMap((locale) => scenarios.map((scenario) => `${locale}/${scenario}`)));
  const keys = records.map((record) => `${record.locale}/${record.scenario}`);
  if (records.length !== expected.size) problems.push(`expected ${expected.size} records, received ${records.length}`);
  for (const key of expected) if (!keys.includes(key)) problems.push(`missing ${key}`);
  if (new Set(keys).size !== keys.length) problems.push('duplicate locale/scenario records');
  for (const group of expectedGroups) if (!completedGroups.has(group)) problems.push(`incomplete group ${group}`);
  for (const group of completedGroups) if (!expectedGroups.has(group)) problems.push(`unexpected group ${group}`);
  const paths = records.flatMap((record) => [record.screenshot.path, record.accessibility.path]);
  if (new Set(paths).size !== paths.length) problems.push('duplicate artifact paths');
  for (const record of records) {
    for (const artifact of [record.screenshot, record.accessibility]) {
      if (!artifact.path.startsWith(`${evidenceRoot}/`) || !existsSync(artifact.path)) problems.push(`missing artifact ${artifact.path}`);
      else if (hashFile(artifact.path) !== artifact.sha256) problems.push(`hash mismatch ${artifact.path}`);
    }
    if (record.diagnostics.consoleErrors.length || record.diagnostics.pageErrors.length) problems.push(`diagnostics ${record.locale}/${record.scenario}`);
  }
  if (!capturedSourceHash || capturedSourceHash !== currentSourceHash) problems.push('source changed during run');
  problems.push(...validateDecisionHashes(capturedDecisionHashes, currentDecisionHashes));
  return problems;
}

function supersededRuns() {
  const log = resolve(evidenceBase, 'rejected/production-focused-mixed-selector.log');
  return existsSync(log) ? [{ accepted: false, reason: 'mixed-language selectors; locale scenarios not reached', log }] : [];
}

function rejectRoot(): string {
  const root = resolve(evidenceBase, 'rejected', evidenceRunId ?? 'missing-run-id');
  mkdirSync(resolve(evidenceBase, 'rejected'), { recursive: true });
  if (existsSync(root)) throw new Error(`immutable rejected run already exists: ${root}`);
  return root;
}

function normalizeRecord(record: EvidenceRecord, root: string): EvidenceRecord {
  if (root === evidenceRoot) return record;
  return {
    ...record,
    screenshot: { ...record.screenshot, path: record.screenshot.path.replace(evidenceRoot, root) },
    accessibility: { ...record.accessibility, path: record.accessibility.path.replace(evidenceRoot, root) },
  };
}

function hashSources(): string {
  const hash = createHash('sha256');
  for (const file of sourceFiles) hash.update(file).update('\0').update(readFileSync(resolve(repositoryRoot, file))).update('\0');
  return hash.digest('hex');
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
