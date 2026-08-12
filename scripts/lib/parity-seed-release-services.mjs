const LOCAL_RESOURCE_REQUIREMENTS = Object.freeze({
  cpuMillicores: 100,
  memoryBytes: 67_108_864,
  diskBytes: 67_108_864,
});

export async function seedParityReleaseServiceRequirements({ prisma, ids }) {
  const serviceSpecs = [
    { id: ids.svcWeb, healthCheckUrl: null },
    { id: ids.svcApi, healthCheckUrl: "http://127.0.0.1:4300/health" },
    { id: ids.svcWebProduction, healthCheckUrl: null },
    { id: ids.svcApiProduction, healthCheckUrl: "http://127.0.0.1:4301/health",
      managedProcess: true },
  ];
  for (const spec of serviceSpecs) {
    const service = await prisma.applicationService.findUnique({
      where: { id: spec.id },
      select: { deployConfig: true },
    });
    if (!service) throw new Error(`PARITY_SERVICE_MISSING:${spec.id}`);
    const deployConfig = asRecord(service.deployConfig);
    if (spec.healthCheckUrl) deployConfig.healthCheckUrl = spec.healthCheckUrl;
    else delete deployConfig.healthCheckUrl;
    if (spec.managedProcess) {
      deployConfig.workloadExecutionMode = "managed-process-v1";
      deployConfig.deployCommand = "node dist-production/server.js";
      delete deployConfig.statusCommand;
      delete deployConfig.failureCleanupCommand;
    }
    await prisma.applicationService.update({
      where: { id: spec.id },
      data: {
        deployConfig: {
          ...deployConfig,
          resourceRequirements: LOCAL_RESOURCE_REQUIREMENTS,
        },
      },
    });
  }
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
