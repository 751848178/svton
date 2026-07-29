import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplyRepositorySuggestionsDto } from './dto/repository-analysis.dto';
import { RepositoryDecision } from './repository-apply.types';
import { redactRepositoryValue } from './repository-analysis-redact.utils';
import { repositoryError } from './repository-analysis-validation.utils';
import { RepositorySuggestionApplyRepository } from './repository-suggestion-apply.repository';

@Injectable()
export class RepositorySuggestionApplyService {
  constructor(private readonly repository: RepositorySuggestionApplyRepository) {}

  async apply(
    teamId: string,
    userId: string,
    projectId: string,
    runId: string,
    dto: ApplyRepositorySuggestionsDto,
  ) {
    const run = await this.repository.load(teamId, projectId, runId);
    if (!run) throw new NotFoundException(repositoryError(
      'REPOSITORY_ANALYSIS_NOT_FOUND',
      '解析运行不存在',
      '请从当前项目的解析历史重新选择。',
    ));
    if (run.status !== 'succeeded') throw new BadRequestException(repositoryError(
      'REPOSITORY_ANALYSIS_NOT_APPLICABLE',
      '只有成功的解析运行可以应用建议',
      '请等待解析完成，或修复失败后重试。',
    ));
    if (run.connection.commitSha !== run.commitSha) {
      throw new ConflictException(repositoryError(
        'REPOSITORY_ANALYSIS_STALE',
        '仓库连接已更新到其他 commit',
        '请基于当前连接重新解析后再应用。',
      ));
    }
    const decisionById = new Map(dto.decisions.map((item) => [item.suggestionId, item]));
    if (decisionById.size !== dto.decisions.length
      || run.suggestions.some((item) => !decisionById.has(item.id))
      || decisionById.size !== run.suggestions.length) {
      throw new BadRequestException(repositoryError(
        'REPOSITORY_SUGGESTIONS_INCOMPLETE',
        '必须逐项确认、编辑或忽略全部建议',
        '请处理每一条建议后再应用。',
      ));
    }
    const decisions: RepositoryDecision[] = run.suggestions.map((suggestion) => {
      const input = decisionById.get(suggestion.id)!;
      if (input.decision === 'edit' && !input.value) throw new BadRequestException(repositoryError(
        'REPOSITORY_SUGGESTION_VALUE_REQUIRED',
        '编辑建议必须提供修改后的值',
        '请完成编辑内容后重试。',
      ));
      return {
        suggestion,
        status: input.decision === 'accept' ? 'accepted'
          : input.decision === 'edit' ? 'edited' : 'rejected',
        value: input.decision === 'edit'
          ? sanitizeValue(input.value!)
          : input.decision === 'accept'
            ? sanitizeValue(suggestion.proposedValue)
            : undefined,
      };
    });
    const required = decisions.filter((item) =>
      ['project_repository', 'environment', 'application_service'].includes(item.suggestion.kind),
    );
    return this.repository.apply({
      teamId,
      userId,
      projectId,
      runId,
      commitSha: run.commitSha,
      markConnectionApplied: required.every((item) => item.status !== 'rejected'),
      decisions,
    });
  }
}

function sanitizeValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(repositoryError(
      'REPOSITORY_SUGGESTION_VALUE_INVALID',
      '建议值必须是结构化对象',
      '请恢复检测值或重新编辑。',
    ));
  }
  const cloned = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  if (JSON.stringify(redactRepositoryValue(cloned)) !== JSON.stringify(cloned)) {
    throw new BadRequestException(repositoryError(
      'REPOSITORY_SUGGESTION_SECRET_VALUE',
      '建议值包含凭据或秘密赋值',
      '请移除命令中的明文凭据并通过环境变量或秘密引用注入。',
    ));
  }
  return cloned;
}
