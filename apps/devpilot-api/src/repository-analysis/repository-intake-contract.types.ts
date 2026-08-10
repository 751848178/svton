export type RepositoryProjectType =
  | 'web_application'
  | 'backend_service'
  | 'static_site'
  | 'mixed_application';
export type RepositoryArchitecture = 'monorepo' | 'single_repository';
export type RepositoryDeploymentPlan =
  | 'container'
  | 'docker_compose'
  | 'static_site'
  | 'process';
export type RepositoryComponentType =
  | 'frontend_site'
  | 'backend_service'
  | 'worker'
  | 'shared_package'
  | 'service';
export type RepositoryBuildOutput =
  | 'oci_image'
  | 'static_bundle'
  | 'runtime_bundle'
  | 'none';
export type RepositoryRunMethod = 'container' | 'static_site' | 'process' | 'worker';

export interface RepositoryIntakeOverviewValue {
  projectType: RepositoryProjectType;
  architecture: RepositoryArchitecture;
  packageManager: string;
  deploymentPlan: RepositoryDeploymentPlan;
}

export interface RepositoryIntakeComponentValue {
  name: string;
  path: string;
  type: RepositoryComponentType;
  buildOutput: RepositoryBuildOutput;
  runMethod: RepositoryRunMethod;
}
