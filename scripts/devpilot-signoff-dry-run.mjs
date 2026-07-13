#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const requiredArtifacts = [
  '.agent-board/release-evidence/G004-S024-release-evidence-index.md',
  'docs/devpilot/external-signoff-pack.md',
  '.agent-board/results/S019-result.json',
  '.agent-board/results/S020-result.json',
  '.agent-board/results/S021-result.json',
  '.agent-board/results/S022-result.json',
  '.agent-board/verification/S019-verification.json',
  '.agent-board/verification/S020-verification.json',
  '.agent-board/verification/S021-verification.json',
  '.agent-board/verification/S022-verification.json',
];

const externalOnlyChecks = [
  {
    id: 'real-provider-resource-provisioning',
    requiredApproval: 'approved provider credentials and staging or production target ids',
  },
  {
    id: 'production-backup-rollback-rehearsal',
    requiredApproval: 'release owner and ops approval for backup target and rollback window',
  },
  {
    id: 'live-restore-approval',
    requiredApproval: 'restore approval, isolated target, validation query, and rollback plan',
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function artifactStatus(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return {
    path: relativePath,
    exists: fs.existsSync(absolutePath),
  };
}

function collectLocalChecks() {
  const artifacts = requiredArtifacts.map(artifactStatus);
  const missing = artifacts.filter((artifact) => !artifact.exists);
  if (missing.length > 0) {
    return {
      status: 'failed',
      artifacts,
      checks: [],
      missing: missing.map((artifact) => artifact.path),
    };
  }

  const results = ['S019', 'S020', 'S021', 'S022'].map((slice) => ({
    slice,
    resultStatus: readJson(`.agent-board/results/${slice}-result.json`).status,
    verificationStatus: readJson(`.agent-board/verification/${slice}-verification.json`).status,
  }));

  const failed = results.filter(
    (result) => result.resultStatus !== 'done' || result.verificationStatus !== 'passed',
  );

  return {
    status: failed.length === 0 ? 'passed' : 'failed',
    artifacts,
    checks: results,
    missing: [],
  };
}

function main() {
  const local = collectLocalChecks();
  const status = local.status === 'passed' ? 'dry_run_passed_external_only_remaining' : 'failed';
  const summary = {
    status,
    generatedAt: new Date().toISOString(),
    local,
    externalOnly: externalOnlyChecks.map((check) => ({
      ...check,
      status: 'external_only',
      localExecution: 'not_attempted',
    })),
    declarationBoundary:
      'This dry-run validates local evidence packaging only. It does not connect to real cloud providers, staging, or production targets.',
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(local.status === 'passed' ? 0 : 1);
}

main();
