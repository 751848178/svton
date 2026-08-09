const SERVICES = Object.freeze([
  "api",
  "web",
  "route-control",
  "deploy-target",
  "target-workload",
]);

export async function buildRuntimeImagesSequentially(images, build) {
  if (
    typeof build !== "function" ||
    JSON.stringify(Object.keys(images || {})) !== JSON.stringify(SERVICES)
  ) {
    throw new Error("PARITY_RUNTIME_IMAGE_BUILD_INVALID: service-inventory");
  }
  for (const service of SERVICES) await build(service);
  return SERVICES;
}
