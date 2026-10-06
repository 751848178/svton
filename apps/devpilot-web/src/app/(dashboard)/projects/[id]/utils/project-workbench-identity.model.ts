import type { Project, ProjectApplication } from '../types';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import type {
  RepositoryAnalysisRun,
  RepositoryAnalysisState,
} from '../types/repository-analysis.types';

export interface ProjectWorkbenchIdentity {
  projectId: string;
  name: string;
  repository: string | null;
  branch: string | null;
  commitSha: string | null;
}

export interface RepositoryIdentityEvidence {
  state: RepositoryAnalysisState;
  selectedRun: RepositoryAnalysisRun | null;
}

export function projectIdentityFromProject(
  project: Project,
  analysis: RepositoryIdentityEvidence,
): ProjectWorkbenchIdentity {
  return {
    projectId: project.id,
    name: project.name,
    repository:
      project.gitRepo ??
      analysis.state.canonicalIdentity?.canonicalUrl ??
      analysis.state.connection?.repositoryUrl ??
      null,
    branch: resolveBranch(analysis, project.applications?.[0]),
    commitSha: analysis.selectedRun?.commitSha ?? analysis.state.connection?.commitSha ?? null,
  };
}

export function projectIdentityFromSummary(
  summary: ProjectDeliverySummary,
  analysis: RepositoryIdentityEvidence,
): ProjectWorkbenchIdentity {
  return {
    projectId: summary.project.id,
    name: summary.project.name,
    repository:
      summary.repository?.canonicalUrl ??
      analysis.state.canonicalIdentity?.canonicalUrl ??
      analysis.state.connection?.repositoryUrl ??
      null,
    branch: resolveBranch(analysis) ?? summary.repository?.defaultBranch ?? null,
    commitSha: analysis.selectedRun?.commitSha ?? analysis.state.connection?.commitSha ?? null,
  };
}

function resolveBranch(
  analysis: RepositoryIdentityEvidence,
  application?: ProjectApplication,
): string | null {
  return (
    analysis.state.canonicalIdentity?.effectiveRevision?.defaultBranch ??
    analysis.selectedRun?.branch ??
    analysis.state.connection?.selectedBranch ??
    application?.defaultBranch ??
    null
  );
}
