const COMPONENTS = Object.freeze([
  Object.freeze({
    name: "web",
    repoPath: "apps/web",
    staging: Object.freeze({
      workingDirectory: "apps/web",
      buildCommand: "node scripts/build.mjs",
      artifactPaths: ["apps/web/dist"],
      workloadExecutionMode: "managed-command-v1",
      deployCommand: "test -f dist/index.html",
      statusCommand: "test -f dist/index.html",
      failureCleanupCommand: "true",
    }),
    production: Object.freeze({
      workingDirectory: "apps/web",
      buildCommand:
        "node scripts/build.mjs && mkdir -p dist-production && cp -f dist/index.html dist-production/index.html",
      artifactPaths: ["apps/web/dist-production"],
      workloadExecutionMode: "managed-command-v1",
      deployCommand: "test -f dist-production/index.html",
      statusCommand: "test -f dist-production/index.html",
      failureCleanupCommand: "true",
    }),
  }),
  Object.freeze({
    name: "api",
    repoPath: "apps/api",
    staging: Object.freeze({
      workingDirectory: "apps/api",
      buildCommand: "node scripts/build.mjs",
      artifactPaths: ["apps/api/dist"],
      workloadExecutionMode: "managed-command-v1",
      deployCommand: "test -f dist/server.js",
      statusCommand: "test -f dist/server.js",
      failureCleanupCommand: "true",
    }),
    production: Object.freeze({
      workingDirectory: "apps/api",
      buildCommand:
        "node scripts/build.mjs && mkdir -p dist-production && cp -f dist/server.js dist-production/server.js",
      artifactPaths: ["apps/api/dist-production"],
      workloadExecutionMode: "managed-command-v1",
      deployCommand: "test -f dist-production/server.js",
      statusCommand: "test -f dist-production/server.js",
      failureCleanupCommand: "true",
    }),
  }),
]);

export async function bindPositiveApplicationContracts(prisma, scope) {
  const applications = await prisma.application.findMany({
    where: { projectId: scope.projectId, status: "active" },
    select: {
      id: true,
      name: true,
      repoPath: true,
      services: {
        where: { status: "active" },
        select: { id: true, name: true, environmentId: true },
      },
    },
  });
  const bound = [];
  for (const component of COMPONENTS) {
    const application = applications.find(
      (item) =>
        item.repoPath === component.repoPath || item.name === component.name,
    );
    if (!application) throw contractError(`application-${component.name}`);
    const canonicalName =
      application.services.find(
        (service) => service.environmentId === scope.productionEnvId,
      )?.name || component.name;
    const staging = await bindService(
      prisma,
      scope,
      application,
      component,
      "staging",
      canonicalName,
    );
    const production = await bindService(
      prisma,
      scope,
      application,
      component,
      "production",
      canonicalName,
    );
    bound.push({ applicationId: application.id, staging, production });
  }
  return bound;
}

function bindService(prisma, scope, application, component, role, name) {
  const environmentId =
    role === "staging" ? scope.stagingEnvId : scope.productionEnvId;
  const existing = application.services.find(
    (service) => service.environmentId === environmentId,
  );
  if (existing) {
    return prisma.applicationService.update({
      where: { id: existing.id },
      data: { status: "active", deployConfig: component[role] },
      select: { id: true },
    });
  }
  return prisma.applicationService.upsert({
    where: {
      applicationId_environmentId_name: {
        applicationId: application.id,
        environmentId,
        name,
      },
    },
    create: {
      teamId: scope.teamId,
      projectId: scope.projectId,
      applicationId: application.id,
      environmentId,
      name,
      status: "active",
      deployConfig: component[role],
    },
    update: { status: "active", deployConfig: component[role] },
    select: { id: true },
  });
}

function contractError(reason) {
  return new Error(`PARITY_POSITIVE_DELIVERY_CLAIM_INVALID: ${reason}`);
}
