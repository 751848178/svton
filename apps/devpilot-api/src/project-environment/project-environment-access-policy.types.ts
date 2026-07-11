export interface ProjectEnvironmentAuthRequest {
  user: { id: string };
  teamId: string;
}

export type ReadableProjectEnvironmentRecord = {
  id: string;
  projectId: string;
};

export type EnvironmentScope = {
  projectId: string;
  environmentId: string;
};

export type EnvironmentCopyScope = {
  projectId: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
};
