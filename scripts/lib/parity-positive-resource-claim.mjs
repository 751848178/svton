export async function claimPositiveResources(prisma, ids, scope) {
  await Promise.all([
    bindServer(prisma, ids, scope, "staging"),
    bindServer(prisma, ids, scope, "production"),
  ]);
  await Promise.all([
    prisma.secretKey.update({
      where: { id: ids.secret },
      data: { projectId: scope.projectId, environmentId: null },
    }),
    prisma.resourceInstance.update({
      where: { id: ids.resourceInstance },
      data: { projectId: scope.projectId, environmentId: null },
    }),
    prisma.site.update({
      where: { id: ids.site },
      data: {
        projectId: scope.projectId,
        environmentId: scope.productionEnvId,
      },
    }),
    prisma.managedResource.update({
      where: { id: ids.managedResource },
      data: {
        projectId: scope.projectId,
        environmentId: scope.productionEnvId,
      },
    }),
    prisma.resourceConnectionRun.update({
      where: { id: ids.connectionRun },
      data: {
        projectId: scope.projectId,
        environmentId: scope.productionEnvId,
      },
    }),
    prisma.resourceMetricSnapshot.update({
      where: { id: ids.metricSnapshot },
      data: {
        projectId: scope.projectId,
        environmentId: scope.productionEnvId,
      },
    }),
    prisma.backupRun.update({
      where: { id: ids.backupRun },
      data: {
        projectId: scope.projectId,
        environmentId: scope.productionEnvId,
      },
    }),
    prisma.logStream.update({
      where: { id: ids.logStream },
      data: {
        projectId: scope.projectId,
        environmentId: scope.productionEnvId,
      },
    }),
    prisma.logCollectionRun.update({
      where: { id: ids.logRun },
      data: {
        projectId: scope.projectId,
        environmentId: scope.productionEnvId,
      },
    }),
  ]);
}

function bindServer(prisma, ids, scope, role) {
  const environmentId =
    role === "staging" ? scope.stagingEnvId : scope.productionEnvId;
  return prisma.projectEnvironmentServer.upsert({
    where: {
      environmentId_serverId: { environmentId, serverId: ids.server },
    },
    create: {
      teamId: scope.teamId,
      projectId: scope.projectId,
      environmentId,
      serverId: ids.server,
      role: `${role}-target`,
      metadata: deploymentMetadata(),
    },
    update: {
      status: "active",
      role: `${role}-target`,
      metadata: deploymentMetadata(),
    },
  });
}

function deploymentMetadata() {
  return {
    releaseDeployment: {
      providerKey: "local-filesystem-v1",
      targetRef: "filesystem-release-target",
    },
  };
}
