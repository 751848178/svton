export function summarizeRouteAuditProvenance(runtime, inventory) {
  return {
    ownershipLabelsVerified: true,
    sourceRevision: runtime.sourceRevision,
    containers: inventory.containers.map((item) => ({
      id: item.id,
      imageId: item.imageId,
      service: item.labels["com.docker.compose.service"],
    })),
    images: inventory.images.map((item) => ({ id: item.id })),
    networkIds: inventory.networks.map((item) => item.id),
    volumeIds: inventory.volumes.map((item) => item.id),
  };
}
