export function productionGateRepairHref(input: {
  projectId: string;
  environmentId: string;
  environmentKey: string;
  gateId?: string;
  serviceId?: string;
}) {
  if (!input.gateId || input.gateId === "D13") return undefined;
  if (["D05", "D17"].includes(input.gateId)) {
    return `/applications?projectId=${encodeURIComponent(input.projectId)}` +
      `&environmentId=${encodeURIComponent(input.environmentId)}` +
      `${input.serviceId ? `&serviceId=${encodeURIComponent(input.serviceId)}` : ""}` +
      "&action=edit-deployment";
  }
  const tab = ["D14", "D15", "D16"].includes(input.gateId)
    ? "routes"
    : input.gateId === "D18" ? "protection"
      : input.gateId === "D08" || input.gateId === "D12"
        ? "resources"
        : "targets";
  const anchor = input.gateId === "D18" ? "#observability" : "";
  return `/projects/${input.projectId}/settings?section=environments` +
    `&env=${encodeURIComponent(input.environmentKey)}&envTab=${tab}${anchor}`;
}
