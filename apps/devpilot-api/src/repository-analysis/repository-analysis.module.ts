import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event/audit-event.module';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { RepositoryIdentityModule } from '../repository-identity/repository-identity.module';
import { RepositoryAnalysisAccessService } from './repository-analysis-access.service';
import { RepositoryAnalysisAuditService } from './repository-analysis-audit.service';
import { RepositoryAnalysisController } from './repository-analysis.controller';
import { RepositoryAnalysisRunRepository } from './repository-analysis-run.repository';
import { RepositoryAnalysisRunClaimRepository } from './repository-analysis-run-claim.repository';
import { RepositoryAnalysisRunService } from './repository-analysis-run.service';
import { RepositoryAnalysisStageRepository } from './repository-analysis-stage.repository';
import { RepositoryAnalysisWorkerService } from './repository-analysis-worker.service';
import { RepositoryApplicationApplyRepository } from './repository-application-apply.repository';
import { RepositoryConnectionRepository } from './repository-connection.repository';
import { RepositoryConnectionService } from './repository-connection.service';
import { RepositoryCredentialService } from './repository-credential.service';
import { RepositoryGitCommandService } from './repository-git-command.service';
import { RepositoryGitExecutorService } from './repository-git-executor.service';
import { RepositoryInventoryService } from './repository-inventory.service';
import { RepositoryIdentityBranchService } from './repository-identity-branch.service';
import { RepositoryIntakeSnapshotWriter } from './repository-intake-snapshot.writer';
import { RepositoryParserService } from './repository-parser.service';
import { RepositoryPlatformApplyRepository } from './repository-platform-apply.repository';
import { RepositorySuggestionApplyRepository } from './repository-suggestion-apply.repository';
import { RepositorySuggestionApplyService } from './repository-suggestion-apply.service';
import { RepositorySuggestionBuilderService } from './repository-suggestion-builder.service';

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule, RepositoryIdentityModule],
  controllers: [RepositoryAnalysisController],
  providers: [
    RepositoryAnalysisAccessService,
    RepositoryAnalysisAuditService,
    RepositoryAnalysisRunRepository,
    RepositoryAnalysisRunClaimRepository,
    RepositoryAnalysisRunService,
    RepositoryAnalysisStageRepository,
    RepositoryAnalysisWorkerService,
    RepositoryApplicationApplyRepository,
    RepositoryConnectionRepository,
    RepositoryConnectionService,
    RepositoryCredentialService,
    RepositoryGitCommandService,
    RepositoryGitExecutorService,
    RepositoryInventoryService,
    RepositoryIdentityBranchService,
    RepositoryIntakeSnapshotWriter,
    RepositoryParserService,
    RepositoryPlatformApplyRepository,
    RepositorySuggestionApplyRepository,
    RepositorySuggestionApplyService,
    RepositorySuggestionBuilderService,
  ],
  exports: [
    RepositoryAnalysisRunService,
    RepositoryConnectionService,
    RepositoryCredentialService,
    RepositoryGitExecutorService,
    RepositorySuggestionApplyService,
  ],
})
export class RepositoryAnalysisModule {}
