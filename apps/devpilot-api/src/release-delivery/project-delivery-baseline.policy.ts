export type ProjectDeliveryBaselineFacts = {
  id: string;
  teamId: string;
  projectId: string;
  key: string;
  name: string;
  status: string;
  baselineRole: string | null;
  identityLockedAt: Date | null;
  currentConfigRevisionId: string | null;
  currentConfigRevision: {
    id: string;
    teamId: string;
    projectId: string;
    environmentId: string;
  } | null;
};

export function isProjectDeliveryBaseline(
  project: { id: string; teamId: string },
  environment: ProjectDeliveryBaselineFacts,
  role: "staging" | "production",
) {
  return environment.teamId === project.teamId &&
    environment.projectId === project.id && environment.status === "active" &&
    environment.baselineRole === role;
}

export function presentProjectDeliveryBaseline(
  project: { id: string; teamId: string },
  environment: ProjectDeliveryBaselineFacts,
) {
  const revision = environment.currentConfigRevision;
  const ready = environment.identityLockedAt !== null &&
    environment.currentConfigRevisionId !== null &&
    environment.currentConfigRevisionId === revision?.id &&
    revision.teamId === project.teamId && revision.projectId === project.id &&
    revision.environmentId === environment.id;
  return {
    id: environment.id,
    key: environment.key,
    name: environment.name,
    ready,
  };
}
