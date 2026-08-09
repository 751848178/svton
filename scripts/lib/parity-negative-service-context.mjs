export async function requireActiveEnvironmentService(
  prisma,
  { projectId, environmentId, contract },
) {
  const component = contract?.component;
  const serviceId = contract?.production?.id;
  const applicationId = contract?.applicationId;
  if (![component, serviceId, applicationId].every(nonEmpty)) {
    throw new Error("dynamic environment service contract missing");
  }
  const service = await prisma.applicationService.findFirst({
    where: {
      id: serviceId,
      projectId,
      environmentId,
      applicationId,
      status: "active",
    },
    select: { id: true },
  });
  if (!service || service.id !== serviceId) {
    throw new Error(`dynamic environment service missing: ${component}`);
  }
  return service.id;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
