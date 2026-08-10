import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { RepositorySuggestionApplyService } from '../repository-analysis/repository-suggestion-apply.service';
import { repositoryError } from '../repository-analysis/repository-analysis-validation.utils';
import type { ReviewRepositoryIntakeContractDto } from './dto/repository-intake-review.dto';
import { RepositoryIntakeContractService } from './repository-intake-contract.service';
import { RepositoryIntakeContractRepository } from './repository-intake-contract.repository';
import { normalizeRepositoryIntakeReview } from './repository-intake-review.normalizer';

@Injectable()
export class RepositoryIntakeReviewService {
  constructor(
    private readonly repository: RepositoryIntakeContractRepository,
    private readonly contracts: RepositoryIntakeContractService,
    private readonly suggestions: RepositorySuggestionApplyService,
  ) {}

  async review(
    teamId: string,
    actorId: string,
    projectId: string,
    runId: string,
    dto: ReviewRepositoryIntakeContractDto,
  ) {
    const run = await this.repository.load(teamId, projectId, runId);
    if (!run) throw new NotFoundException(repositoryError(
      'REPOSITORY_ANALYSIS_NOT_FOUND', '仓库分析运行不存在', '请重新发起仓库分析。',
    ));
    if (run.status !== 'succeeded') throw new BadRequestException(repositoryError(
      'REPOSITORY_ANALYSIS_NOT_APPLICABLE', '只有成功的仓库分析可以确认',
      run.status === 'failed' ? '请按失败原因重试分析。' : '请等待分析完成。',
    ));
    if (run.connection.commitSha !== run.commitSha) {
      throw new ConflictException(repositoryError(
        'REPOSITORY_ANALYSIS_STALE', '仓库已移动到其他 Commit',
        '请返回第一步重新验证仓库并分析当前 Commit。',
      ));
    }
    const normalized = normalizeRepositoryIntakeReview(run, dto);
    const inputHash = createHash('sha256').update(JSON.stringify({
      version: 1,
      runId,
      branch: run.branch,
      commitSha: run.commitSha,
      decisions: normalized.decisions,
    })).digest('hex');
    const existing = run.intakeReviewSnapshot;
    if (existing) return this.replayOrConflict(teamId, projectId, runId, inputHash, existing.inputHash);
    try {
      await this.suggestions.apply(teamId, actorId, projectId, runId, normalized, {
        version: 1,
        inputHash,
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const winner = await this.repository.findSnapshot(runId);
      if (!winner) throw error;
      return this.replayOrConflict(teamId, projectId, runId, inputHash, winner.inputHash);
    }
    return this.contracts.read(teamId, projectId, runId);
  }

  private replayOrConflict(
    teamId: string,
    projectId: string,
    runId: string,
    inputHash: string,
    storedHash: string,
  ) {
    if (inputHash === storedHash) return this.contracts.read(teamId, projectId, runId);
    throw new ConflictException(repositoryError(
      'REPOSITORY_INTAKE_REVIEW_IMMUTABLE', '该分析运行已经形成不可变确认快照',
      '读取已确认快照，或重新分析当前仓库后创建新的确认。',
    ));
  }
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && ['P2002', 'P2034'].includes(error.code);
}
