import type {
  DetectedService,
  RepositoryAnalysisResult,
} from './repository-parser.types';
import type {
  RepositoryIntakeComponentValue,
  RepositoryIntakeOverviewValue,
} from './repository-intake-contract.types';

export function detectIntakeOverview(
  result: RepositoryAnalysisResult,
): RepositoryIntakeOverviewValue {
  const deployable = result.services.filter(
    (service) => service.deployable || service.artifactOnly,
  );
  const roles = new Set(deployable.map(intakeRole));
  return {
    projectType: roles.has('frontend') && roles.size > 1
      ? 'mixed_application'
      : roles.has('frontend') ? 'web_application'
        : roles.has('static') ? 'static_site' : 'backend_service',
    architecture: result.repository.monorepo ? 'monorepo' : 'single_repository',
    packageManager: result.repository.packageManager || 'unknown',
    deploymentPlan: detectDeploymentPlan(deployable),
  };
}

export function detectIntakeComponent(
  service: DetectedService,
): RepositoryIntakeComponentValue {
  const role = intakeRole(service);
  const container = Boolean(
    service.container.dockerfile || service.container.composeFiles.length,
  );
  const staticBundle = role === 'static'
    || service.artifacts.some((artifact) => /(^|\/)(dist|build|out)(\/|$)/.test(artifact));
  return {
    name: service.name,
    path: service.path || '.',
    type: role === 'frontend' ? 'frontend_site'
      : role === 'worker' ? 'worker'
        : role === 'shared' ? 'shared_package'
          : role === 'static' ? 'frontend_site'
            : role === 'backend' ? 'backend_service' : 'service',
    buildOutput: container ? 'oci_image'
      : staticBundle ? 'static_bundle'
        : service.artifacts.length ? 'runtime_bundle' : 'none',
    runMethod: container ? 'container'
      : role === 'static' || service.artifactOnly ? 'static_site'
        : role === 'worker' ? 'worker' : 'process',
  };
}

function intakeRole(service: DetectedService): string {
  if (service.role !== 'service') return service.role;
  const identity = `${service.path}/${service.name} ${service.commands.start || ''}`;
  if (/worker|queue|consumer/i.test(identity)) return 'worker';
  if (service.framework.some((item) => /next|react|vue|nuxt/i.test(item))) {
    return 'frontend';
  }
  if (/web|frontend|client|\bui\b/i.test(identity)) return 'frontend';
  return service.role;
}

function detectDeploymentPlan(
  services: DetectedService[],
): RepositoryIntakeOverviewValue['deploymentPlan'] {
  if (services.some((service) => service.container.composeFiles.length)) {
    return 'docker_compose';
  }
  if (services.some((service) => service.container.dockerfile)) return 'container';
  if (services.length && services.every((service) => service.role === 'static')) {
    return 'static_site';
  }
  return 'process';
}
