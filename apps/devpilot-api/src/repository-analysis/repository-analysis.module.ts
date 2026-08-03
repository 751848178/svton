import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event/audit-event.module';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { RepositoryAnalysisAccessService } from './repository-analysis-access.service';
import { RepositoryAnalysisAuditService } from './repository-analysis-audit.service';
import { RepositoryAnalysisController } from './repository-analysis.controller';
import { RepositoryAnalysisRunRepository } from './repository-analysis-run.repository';
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
import { RepositoryParserService } from './repository-parser.service';
import { RepositoryPlatformApplyRepository } from './repository-platform-apply.repository';
import { RepositorySuggestionApplyRepository } from './repository-suggestion-apply.repository';
import { RepositorySuggestionApplyService } from './repository-suggestion-apply.service';
import { RepositorySuggestionBuilderService } from './repository-suggestion-builder.service';

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule],
  controllers: [RepositoryAnalysisController],
  providers: [
    RepositoryAnalysisAccessService,
    RepositoryAnalysisAuditService,
    RepositoryAnalysisRunRepository,
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
