import { Injectable, NotFoundException } from '@nestjs/common';
import { repositoryError } from '../repository-analysis/repository-analysis-validation.utils';
import { presentRepositoryIntakeContract } from './repository-intake-contract.presenter';
import { RepositoryIntakeContractRepository } from './repository-intake-contract.repository';

@Injectable()
export class RepositoryIntakeContractService {
  constructor(private readonly repository: RepositoryIntakeContractRepository) {}

  async read(teamId: string, projectId: string, runId: string) {
    const run = await this.repository.load(teamId, projectId, runId);
    if (!run) throw new NotFoundException(repositoryError(
      'REPOSITORY_ANALYSIS_NOT_FOUND',
      '仓库分析运行不存在',
      '请返回确认识别步骤并选择当前运行。',
    ));
    return presentRepositoryIntakeContract(run);
  }
}
