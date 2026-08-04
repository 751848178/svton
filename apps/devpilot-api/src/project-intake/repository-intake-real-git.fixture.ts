import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { execFile } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { AuditEventService } from '../audit-event/audit-event.service';
import { createTestCryptoService } from '../common/crypto/crypto.test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectGovernanceBaselineService } from '../project/project-governance-baseline.service';
import { ProjectGovernanceFinalizationService } from '../project/project-governance-finalization.service';
import { RepositoryAnalysisAuditService } from '../repository-analysis/repository-analysis-audit.service';
import { RepositoryAnalysisRunRepository } from '../repository-analysis/repository-analysis-run.repository';
import { RepositoryAnalysisRunService } from '../repository-analysis/repository-analysis-run.service';
import { RepositoryAnalysisStageRepository } from '../repository-analysis/repository-analysis-stage.repository';
import { RepositoryAnalysisWorkerService } from '../repository-analysis/repository-analysis-worker.service';
import { RepositoryApplicationApplyRepository } from '../repository-analysis/repository-application-apply.repository';
import { RepositoryConnectionRepository } from '../repository-analysis/repository-connection.repository';
import { RepositoryConnectionService } from '../repository-analysis/repository-connection.service';
import { RepositoryCredentialService } from '../repository-analysis/repository-credential.service';
import { RepositoryGitCommandService } from '../repository-analysis/repository-git-command.service';
import { RepositoryGitExecutorService } from '../repository-analysis/repository-git-executor.service';
import { RepositoryInventoryService } from '../repository-analysis/repository-inventory.service';
import { RepositoryIntakeSnapshotWriter } from '../repository-analysis/repository-intake-snapshot.writer';
import { RepositoryParserService } from '../repository-analysis/repository-parser.service';
import { RepositoryPlatformApplyRepository } from '../repository-analysis/repository-platform-apply.repository';
import { RepositorySuggestionApplyRepository } from '../repository-analysis/repository-suggestion-apply.repository';
import { RepositorySuggestionApplyService } from '../repository-analysis/repository-suggestion-apply.service';
import { RepositorySuggestionBuilderService } from '../repository-analysis/repository-suggestion-builder.service';
import { ProjectIntakeFinalizationExecutorService } from './project-intake-finalization-executor.service';
import { ProjectIntakeFinalizationRecordRepository } from './project-intake-finalization-record.repository';
import { ProjectIntakeFinalizationService } from './project-intake-finalization.service';
import { ProjectIntakeService } from './project-intake.service';
import { ProjectRepositoryDuplicateGuardService } from './project-repository-duplicate-guard.service';
import { RepositoryIntakeContractRepository } from './repository-intake-contract.repository';
import { RepositoryIntakeContractService } from './repository-intake-contract.service';
import { RepositoryIntakeReviewService } from './repository-intake-review.service';

const git = promisify(execFile);

export function createIntakeService(client: PrismaClient, localRoot: string) {
  const db = client as unknown as PrismaService;
  const config = new ConfigService({ REPOSITORY_ANALYSIS_LOCAL_ROOTS: localRoot });
  const audit = new RepositoryAnalysisAuditService(new AuditEventService(db));
  const credentials = new RepositoryCredentialService(db, createTestCryptoService());
  const gitExecutor = new RepositoryGitExecutorService(
    config, new RepositoryGitCommandService(config),
  );
  const connections = new RepositoryConnectionService(
    new RepositoryConnectionRepository(db), credentials, gitExecutor, audit,
  );
  const runRepository = new RepositoryAnalysisRunRepository(db);
  const worker = new RepositoryAnalysisWorkerService(
    config, runRepository, new RepositoryAnalysisStageRepository(db), credentials,
    gitExecutor, new RepositoryInventoryService(config), new RepositoryParserService(),
    new RepositorySuggestionBuilderService(db), audit,
  );
  const runs = new RepositoryAnalysisRunService(
    new RepositoryConnectionRepository(db), runRepository, worker, audit,
  );
  const platform = new RepositoryPlatformApplyRepository(
    new RepositoryApplicationApplyRepository(),
  );
  const apply = new RepositorySuggestionApplyService(
    new RepositorySuggestionApplyRepository(
      db, platform, new RepositoryIntakeSnapshotWriter(),
    ),
  );
  const contractRepository = new RepositoryIntakeContractRepository(db);
  const contracts = new RepositoryIntakeContractService(contractRepository);
  const reviews = new RepositoryIntakeReviewService(contractRepository, contracts, apply);
  const governance = new ProjectGovernanceFinalizationService(
    db, new ProjectGovernanceBaselineService(),
  );
  const finalization = new ProjectIntakeFinalizationService(
    new ProjectIntakeFinalizationRecordRepository(db),
    new ProjectIntakeFinalizationExecutorService(db, governance),
  );
  return new ProjectIntakeService(
    db, new ProjectRepositoryDuplicateGuardService(db), connections, runs,
    contracts, reviews, finalization,
  );
}

export async function createRepository(root: string) {
  for (const path of ['apps/web', 'apps/api', 'apps/worker']) {
    await mkdir(join(root, path), { recursive: true });
  }
  await writeFile(join(root, 'package.json'), JSON.stringify({
    private: true, packageManager: 'pnpm@9.0.0', workspaces: ['apps/*'],
  }));
  await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
  await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  await writePackage(root, 'web', {
    name: 'web', scripts: { build: 'next build', start: 'next start' },
    dependencies: { next: '15.0.0' },
  });
  await writePackage(root, 'api', {
    name: 'api', scripts: { build: 'nest build', start: 'node dist/main.js' },
    dependencies: { '@nestjs/core': '10.0.0' },
  });
  await writePackage(root, 'worker', {
    name: 'worker', scripts: { build: 'tsc', start: 'node dist/worker.js' },
  });
  await writeFile(join(root, 'apps/api/Dockerfile'), dockerfile('dist/main.js'));
  await writeFile(join(root, 'apps/worker/Dockerfile'), dockerfile('dist/worker.js'));
  for (const args of [
    ['init', '-b', 'main'], ['config', 'user.email', 'f415@example.com'],
    ['config', 'user.name', 'F415'], ['add', '.'], ['commit', '-m', 'fixture'],
  ]) await git('git', args, { cwd: root });
}

export async function repositoryFingerprint(root: string) {
  const [{ stdout: commit }, { stdout: tree }, { stdout: status }] = await Promise.all([
    git('git', ['rev-parse', 'refs/heads/main'], { cwd: root }),
    git('git', ['rev-parse', 'refs/heads/main^{tree}'], { cwd: root }),
    git('git', ['status', '--porcelain'], { cwd: root }),
  ]);
  return { commit: commit.trim(), tree: tree.trim(), status: status.trim() };
}

function writePackage(root: string, name: string, value: object) {
  return writeFile(join(root, `apps/${name}/package.json`), JSON.stringify(value));
}

function dockerfile(entry: string) {
  return `FROM node:22\nCMD ["node","${entry}"]\n`;
}
